import { HttpClient, User, UserNotFoundError, UserService, UserServiceError } from './user-service';

const BASE = 'https://api.example.com';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: '1',
  email: 'a@example.com',
  name: 'Alice',
  active: true,
  ...overrides,
});

const makeHttp = () => {
  const get = jest.fn();
  const post = jest.fn();
  return { get, post, client: { get, post } as unknown as HttpClient };
};

describe('UserService', () => {
  describe('constructor', () => {
    it('throws UserServiceError when baseUrl does not use https', () => {
      const { client } = makeHttp();
      expect(() => new UserService(client, { baseUrl: 'http://api.example.com' })).toThrow(UserServiceError);
      expect(() => new UserService(client, { baseUrl: 'http://api.example.com' })).toThrow('baseUrl must use https');
    });
  });

  describe('getUser', () => {
    it('returns the user body on 200 and requests a URL-encoded id', async () => {
      const { client, get } = makeHttp();
      const user = makeUser();
      get.mockResolvedValueOnce({ status: 200, body: user });
      const service = new UserService(client, { baseUrl: BASE });

      await expect(service.getUser('a/b c')).resolves.toEqual(user);
      expect(get).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledWith(`${BASE}/users/a%2Fb%20c`);
    });

    it.each(['', '   '])('rejects blank id %j without calling http', async (id) => {
      const { client, get } = makeHttp();
      const service = new UserService(client, { baseUrl: BASE });

      await expect(service.getUser(id)).rejects.toThrow('id is required');
      expect(get).not.toHaveBeenCalled();
    });

    it('throws UserNotFoundError on 404', async () => {
      const { client, get } = makeHttp();
      get.mockResolvedValueOnce({ status: 404, body: null });
      const service = new UserService(client, { baseUrl: BASE });

      const error = await service.getUser('42').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UserNotFoundError);
      expect((error as Error).message).toBe('User 42 not found');
      expect((error as Error).name).toBe('UserNotFoundError');
    });

    it('throws UserServiceError with status on unexpected 4xx without retrying', async () => {
      const { client, get } = makeHttp();
      get.mockResolvedValue({ status: 403, body: null });
      const service = new UserService(client, { baseUrl: BASE });

      const error = await service.getUser('1').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UserServiceError);
      expect((error as UserServiceError).status).toBe(403);
      expect((error as UserServiceError).name).toBe('UserServiceError');
      expect(get).toHaveBeenCalledTimes(1);
    });

    it('retries on 5xx and succeeds when a later attempt returns 200', async () => {
      const { client, get } = makeHttp();
      const user = makeUser();
      get.mockResolvedValueOnce({ status: 500, body: null }).mockResolvedValueOnce({ status: 200, body: user });
      const service = new UserService(client, { baseUrl: BASE });

      await expect(service.getUser('1')).resolves.toEqual(user);
      expect(get).toHaveBeenCalledTimes(2);
    });

    it('retries after a network error and returns the user once the call succeeds', async () => {
      const { client, get } = makeHttp();
      const user = makeUser();
      get.mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce({ status: 200, body: user });
      const service = new UserService(client, { baseUrl: BASE });

      await expect(service.getUser('1')).resolves.toEqual(user);
      expect(get).toHaveBeenCalledTimes(2);
    });

    it('gives up after the default maxRetries (3 attempts) and throws the last server error', async () => {
      const { client, get } = makeHttp();
      get.mockResolvedValue({ status: 503, body: null });
      const service = new UserService(client, { baseUrl: BASE });

      const error = await service.getUser('1').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UserServiceError);
      expect((error as UserServiceError).status).toBe(503);
      expect((error as UserServiceError).message).toBe('Server error 503');
      expect(get).toHaveBeenCalledTimes(3);
    });

    it('honours a custom maxRetries', async () => {
      const { client, get } = makeHttp();
      get.mockResolvedValue({ status: 500, body: null });
      const service = new UserService(client, { baseUrl: BASE, maxRetries: 4 });

      await expect(service.getUser('1')).rejects.toThrow(UserServiceError);
      expect(get).toHaveBeenCalledTimes(5);
    });

    it('makes a single attempt when maxRetries is 0', async () => {
      const { client, get } = makeHttp();
      get.mockResolvedValue({ status: 500, body: null });
      const service = new UserService(client, { baseUrl: BASE, maxRetries: 0 });

      await expect(service.getUser('1')).rejects.toThrow(UserServiceError);
      expect(get).toHaveBeenCalledTimes(1);
    });

    it('rethrows the original Error instance when every attempt throws', async () => {
      const { client, get } = makeHttp();
      const networkError = new Error('boom');
      get.mockRejectedValue(networkError);
      const service = new UserService(client, { baseUrl: BASE });

      await expect(service.getUser('1')).rejects.toBe(networkError);
      expect(get).toHaveBeenCalledTimes(3);
    });

    it('wraps a non-Error rejection value in a generic UserServiceError', async () => {
      const { client, get } = makeHttp();
      get.mockRejectedValue('nope');
      const service = new UserService(client, { baseUrl: BASE, maxRetries: 0 });

      const error = await service.getUser('1').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UserServiceError);
      expect((error as UserServiceError).message).toBe('Request failed');
      expect((error as UserServiceError).status).toBeUndefined();
    });
  });

  describe('listActiveUsers', () => {
    it('returns only active users sorted by name', async () => {
      const { client, get } = makeHttp();
      get.mockResolvedValueOnce({
        status: 200,
        body: [
          makeUser({ id: '1', name: 'Charlie' }),
          makeUser({ id: '2', name: 'Inactive', active: false }),
          makeUser({ id: '3', name: 'Alice' }),
          makeUser({ id: '4', name: 'Bob' }),
        ],
      });
      const service = new UserService(client, { baseUrl: BASE });

      const users = await service.listActiveUsers();
      expect(users.map((u) => u.name)).toEqual(['Alice', 'Bob', 'Charlie']);
      expect(get).toHaveBeenCalledWith(`${BASE}/users`);
    });

    it('throws UserServiceError with status on non-200 response', async () => {
      const { client, get } = makeHttp();
      get.mockResolvedValueOnce({ status: 401, body: [] });
      const service = new UserService(client, { baseUrl: BASE });

      const error = await service.listActiveUsers().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UserServiceError);
      expect((error as UserServiceError).status).toBe(401);
    });
  });

  describe('createUser', () => {
    const input = { email: 'new@example.com', name: 'New User' };

    it('posts the input to /users and returns the created user on 201', async () => {
      const { client, post } = makeHttp();
      const created = makeUser({ id: '9', email: input.email, name: input.name });
      post.mockResolvedValueOnce({ status: 201, body: created });
      const service = new UserService(client, { baseUrl: BASE });

      await expect(service.createUser(input)).resolves.toEqual(created);
      expect(post).toHaveBeenCalledWith(`${BASE}/users`, input);
    });

    it('rejects an email without @ before calling http', async () => {
      const { client, post } = makeHttp();
      const service = new UserService(client, { baseUrl: BASE });

      await expect(service.createUser({ email: 'invalid', name: 'Valid' })).rejects.toThrow('invalid email');
      expect(post).not.toHaveBeenCalled();
    });

    it('rejects names shorter than 2 characters after trimming', async () => {
      const { client, post } = makeHttp();
      const service = new UserService(client, { baseUrl: BASE });

      await expect(service.createUser({ email: 'a@b.c', name: ' a ' })).rejects.toThrow('name too short');
      expect(post).not.toHaveBeenCalled();
    });

    it('throws a 409 UserServiceError when the email already exists', async () => {
      const { client, post } = makeHttp();
      post.mockResolvedValueOnce({ status: 409, body: null });
      const service = new UserService(client, { baseUrl: BASE });

      const error = await service.createUser(input).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UserServiceError);
      expect((error as UserServiceError).status).toBe(409);
      expect((error as UserServiceError).message).toContain(input.email);
    });

    it.each([200, 500])('throws on unexpected status %d and does not retry', async (status) => {
      const { client, post } = makeHttp();
      post.mockResolvedValue({ status, body: null });
      const service = new UserService(client, { baseUrl: BASE });

      const error = await service.createUser(input).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UserServiceError);
      expect((error as UserServiceError).status).toBe(status);
      expect(post).toHaveBeenCalledTimes(1);
    });
  });
});
