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
const friendMessageFindManyMock = createMockFunction();

const mockPrisma = {
  $queryRaw: queryRawMock,
  friendMessage: {
    findMany: friendMessageFindManyMock,
    count: createMockFunction(),
    findFirst: createMockFunction(),
    create: createMockFunction(),
    updateMany: createMockFunction(),
    findUnique: createMockFunction(),
    delete: createMockFunction(),
    update: createMockFunction(),
  },
};

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
} = require('../src/services/friendService');

describe('friendService visibility filters', () => {
  beforeEach(() => {
    queryRawMock.mockReset();
    friendMessageFindManyMock.mockReset();
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
