const assert = require('node:assert/strict');
const { beforeEach, describe, it } = require('node:test');

/**
 * Simple mock function helper to track calls and override implementations
 */
function createMockFunction() {
  const calls = [];
  let implementation;

  const mockFn = (...args) => {
    calls.push(args);
    if (implementation) {
      return implementation(...args);
    }
    return undefined;
  };

  mockFn.mock = { calls };
  mockFn.mockImplementation = (impl) => {
    implementation = impl;
  };
  mockFn.mockResolvedValue = (value) => {
    implementation = () => Promise.resolve(value);
  };
  mockFn.mockReset = () => {
    calls.length = 0;
    implementation = undefined;
  };

  return mockFn;
}

const queryRawMock = createMockFunction();
const transactionMock = createMockFunction();
const friendMessageFindManyMock = createMockFunction();
const friendMessageCountMock = createMockFunction();
const friendMessageFindFirstMock = createMockFunction();
const friendMessageCreateMock = createMockFunction();
const friendMessageUpdateManyMock = createMockFunction();
const friendMessageFindUniqueMock = createMockFunction();
const friendMessageDeleteMock = createMockFunction();
const friendMessageUpdateMock = createMockFunction();
const friendMessageDeleteManyMock = createMockFunction();

const mockPrisma = {
  $queryRaw: queryRawMock,
  $transaction: transactionMock,
  friendMessage: {
    findMany: friendMessageFindManyMock,
    count: friendMessageCountMock,
    findFirst: friendMessageFindFirstMock,
    create: friendMessageCreateMock,
    updateMany: friendMessageUpdateManyMock,
    findUnique: friendMessageFindUniqueMock,
    delete: friendMessageDeleteMock,
    update: friendMessageUpdateMock,
    deleteMany: friendMessageDeleteManyMock,
  },
};

const resetPrismaMocks = () => {
  queryRawMock.mockReset();
  transactionMock.mockReset();
  friendMessageFindManyMock.mockReset();
  friendMessageCountMock.mockReset();
  friendMessageFindFirstMock.mockReset();
  friendMessageCreateMock.mockReset();
  friendMessageUpdateManyMock.mockReset();
  friendMessageFindUniqueMock.mockReset();
  friendMessageDeleteMock.mockReset();
  friendMessageUpdateMock.mockReset();
  friendMessageDeleteManyMock.mockReset();

  transactionMock.mockImplementation(async (callback) => callback(mockPrisma));
  friendMessageDeleteManyMock.mockImplementation(async () => ({ count: 0 }));
  friendMessageUpdateManyMock.mockImplementation(async () => ({ count: 0 }));
};

resetPrismaMocks();

const prismaModulePath = require.resolve('../src/models/prismaClient.ts');
require.cache[prismaModulePath] = {
  id: prismaModulePath,
  filename: prismaModulePath,
  loaded: true,
  exports: mockPrisma,
} as any;

const {
  getConversationHistory,
  getFriendMessages,
  getSystemMessages,
  deleteFriendMessage,
} = require('../src/services/friendService');

describe('friendService visibility filters', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('excludes receiver-deleted messages in friend inbox query', async () => {
    const fakeResult = [
      {
        senderId: 2,
        receiverId: 1,
        message: 'hello',
        createdAt: new Date(),
        status: 'PENDING',
        seqMess: 1,
        PlayerName: 'Friend',
      },
    ];

    queryRawMock.mockImplementation(async (strings, ...values) => {
      assert.ok(strings.join(' ').includes('a."isReceiverDelete" = false'));
      assert.deepEqual(values, [1]);
      return fakeResult;
    });

    const result = await getFriendMessages(1);

    assert.equal(result.success, true);
    assert.deepEqual(result.data, fakeResult);
    assert.equal(queryRawMock.mock.calls.length, 1);
  });

  it('omits messages deleted by the requesting player in conversation history', async () => {
    const conversation = [
      {
        senderId: 1,
        receiverId: 2,
        message: 'hi',
        createdAt: new Date(),
        status: 'READ',
        seqMess: 1,
        sender: { id: 1, PlayerName: 'Player' },
      },
    ];

    friendMessageFindManyMock.mockResolvedValue(conversation);

    const result = await getConversationHistory(1, 2);

    assert.equal(result.success, true);
    assert.deepEqual(result.data, conversation);
    assert.equal(friendMessageFindManyMock.mock.calls.length, 1);

    const args = friendMessageFindManyMock.mock.calls[0][0];
    const orClauses = args.where.OR;

    assert.deepEqual(
      orClauses.find(
        (clause) =>
          clause.senderId === 1 &&
          clause.receiverId === 2 &&
          clause.isSenderDelete === false
      ),
      { senderId: 1, receiverId: 2, isSenderDelete: false }
    );

    assert.deepEqual(
      orClauses.find(
        (clause) =>
          clause.senderId === 2 &&
          clause.receiverId === 1 &&
          clause.isReceiverDelete === false
      ),
      { senderId: 2, receiverId: 1, isReceiverDelete: false }
    );

    assert.deepEqual(args.orderBy, { createdAt: 'asc' });
  });

  it('filters system messages hidden by the receiver', async () => {
    const systemMessages = [
      {
        senderId: 0,
        receiverId: 1,
        message: 'system message',
        status: 'PENDING',
        createdAt: new Date(),
        seqMess: 99,
      },
    ];

    friendMessageFindManyMock.mockResolvedValue(systemMessages);

    const result = await getSystemMessages(1);

    assert.equal(result.success, true);
    assert.deepEqual(result.data, systemMessages);
    assert.equal(friendMessageFindManyMock.mock.calls.length, 1);

    const args = friendMessageFindManyMock.mock.calls[0][0];
    assert.equal(args.where.isReceiverDelete, false);
    assert.ok(
      args.where.OR.some((clause) => clause.receiverId === 1),
      'Receiver specific clause should be present'
    );
  });
});

describe('deleteFriendMessage conversation cleanup', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('hides messages for the requesting player when the partner has not deleted them', async () => {
    friendMessageFindManyMock.mockResolvedValue([
      {
        senderId: 1,
        receiverId: 2,
        seqMess: 10,
        isSenderDelete: false,
        isReceiverDelete: false,
      },
      {
        senderId: 2,
        receiverId: 1,
        seqMess: 11,
        isSenderDelete: false,
        isReceiverDelete: false,
      },
    ]);

    friendMessageDeleteManyMock.mockImplementation(async (args) => {
      if (args.where.senderId === 1) {
        assert.deepEqual(args.where, {
          senderId: 1,
          receiverId: 2,
          isReceiverDelete: true,
        });
        return { count: 0 };
      }

      if (args.where.senderId === 2) {
        assert.deepEqual(args.where, {
          senderId: 2,
          receiverId: 1,
          isSenderDelete: true,
        });
        return { count: 0 };
      }

      throw new Error('Unexpected deleteMany invocation');
    });

    friendMessageUpdateManyMock.mockImplementation(async (args) => {
      if (args.where.senderId === 1) {
        assert.deepEqual(args.where, {
          senderId: 1,
          receiverId: 2,
          isSenderDelete: false,
        });
        assert.deepEqual(args.data, { isSenderDelete: true });
        return { count: 1 };
      }

      if (args.where.senderId === 2) {
        assert.deepEqual(args.where, {
          senderId: 2,
          receiverId: 1,
          isReceiverDelete: false,
        });
        assert.deepEqual(args.data, { isReceiverDelete: true });
        return { count: 1 };
      }

      throw new Error('Unexpected updateMany invocation');
    });

    const result = await deleteFriendMessage(1, 2);

    assert.equal(result.success, true);
    assert.deepEqual(result.data, { hiddenCount: 2, hardDeletedCount: 0 });
    assert.equal(transactionMock.mock.calls.length, 1);
    assert.equal(friendMessageDeleteManyMock.mock.calls.length, 2);
    assert.equal(friendMessageUpdateManyMock.mock.calls.length, 2);
  });

  it('removes messages once both participants have deleted them', async () => {
    friendMessageFindManyMock.mockResolvedValue([
      {
        senderId: 1,
        receiverId: 2,
        seqMess: 20,
        isSenderDelete: false,
        isReceiverDelete: true,
      },
      {
        senderId: 2,
        receiverId: 1,
        seqMess: 21,
        isSenderDelete: true,
        isReceiverDelete: false,
      },
    ]);

    let deleteCalls = 0;
    friendMessageDeleteManyMock.mockImplementation(async (args) => {
      if (args.where.senderId === 1) {
        deleteCalls += 1;
        assert.deepEqual(args.where, {
          senderId: 1,
          receiverId: 2,
          isReceiverDelete: true,
        });
        return { count: 1 };
      }

      if (args.where.senderId === 2) {
        deleteCalls += 1;
        assert.deepEqual(args.where, {
          senderId: 2,
          receiverId: 1,
          isSenderDelete: true,
        });
        return { count: 1 };
      }

      throw new Error('Unexpected deleteMany invocation');
    });

    friendMessageUpdateManyMock.mockImplementation(async (args) => {
      if (args.where.senderId === 1) {
        assert.deepEqual(args.where, {
          senderId: 1,
          receiverId: 2,
          isSenderDelete: false,
        });
        assert.deepEqual(args.data, { isSenderDelete: true });
        return { count: 0 };
      }

      if (args.where.senderId === 2) {
        assert.deepEqual(args.where, {
          senderId: 2,
          receiverId: 1,
          isReceiverDelete: false,
        });
        assert.deepEqual(args.data, { isReceiverDelete: true });
        return { count: 0 };
      }

      throw new Error('Unexpected updateMany invocation');
    });

    const result = await deleteFriendMessage(1, 2);

    assert.equal(result.success, true);
    assert.deepEqual(result.data, { hiddenCount: 0, hardDeletedCount: 2 });
    assert.equal(transactionMock.mock.calls.length, 1);
    assert.equal(deleteCalls, 2);
    assert.equal(friendMessageUpdateManyMock.mock.calls.length, 2);
  });
});
