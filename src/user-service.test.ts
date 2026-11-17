import { HttpClient, User, UserNotFoundError, UserService, UserServiceError } from './user-service';

const BASE = 'https://api.example.com';

const user = (overrides: Partial<User> = {}): User => ({
  id: '1',
  email: 'a@example.com',
  name: 'Alice',
  active: true,
  ...overrides,
});

function setup(maxRetries?: number) {
  const get = jest.fn();
  const post = jest.fn();
  const http = { get, post } as unknown as HttpClient;
  const service = new UserService(http, { baseUrl: BASE, maxRetries });
  return { get, post, service };
}

describe('UserService', () => {
  describe('constructor', () => {
    it('throws UserServiceError when baseUrl does not use https', () => {
      const http = { get: jest.fn(), post: jest.fn() } as unknown as HttpClient;
      expect(() => new UserService(http, { baseUrl: 'http://api.example.com' })).toThrow(UserServiceError);
      expect(() => new UserService(http, { baseUrl: 'http://api.example.com' })).toThrow('baseUrl must use https');
    });
  });

  describe('getUser', () => {
    it('rejects a blank id without calling the http client', async () => {
      const { get, service } = setup();
      await expect(service.getUser('   ')).rejects.toThrow('id is required');
      expect(get).not.toHaveBeenCalled();
    });

    it('returns the user body and requests a URL-encoded id on 200', async () => {
      const { get, service } = setup();
      const u = user();
      get.mockResolvedValue({ status: 200, body: u });
      await expect(service.getUser('a/b')).resolves.toEqual(u);
      expect(get).toHaveBeenCalledWith(`${BASE}/users/a%2Fb`);
    });

    it('throws UserNotFoundError on 404 without retrying', async () => {
      const { get, service } = setup();
      get.mockResolvedValue({ status: 404, body: null });
      const promise = service.getUser('42');
      await expect(promise).rejects.toBeInstanceOf(UserNotFoundError);
      await expect(promise).rejects.toMatchObject({ name: 'UserNotFoundError', message: 'User 42 not found' });
      expect(get).toHaveBeenCalledTimes(1);
    });

    it('throws UserServiceError with status for other non-200 responses such as 400', async () => {
      const { get, service } = setup();
      get.mockResolvedValue({ status: 400, body: null });
      const promise = service.getUser('1');
      await expect(promise).rejects.toBeInstanceOf(UserServiceError);
      await expect(promise).rejects.toMatchObject({ status: 400, message: 'Unexpected status 400' });
      expect(get).toHaveBeenCalledTimes(1);
    });

    it('retries on 5xx and returns the user once the server recovers', async () => {
      const { get, service } = setup();
      const u = user();
      get.mockResolvedValueOnce({ status: 500, body: null }).mockResolvedValueOnce({ status: 200, body: u });
      await expect(service.getUser('1')).resolves.toEqual(u);
      expect(get).toHaveBeenCalledTimes(2);
    });

    it('retries after a network error and succeeds on the next attempt', async () => {
      const { get, service } = setup();
      const u = user();
      get.mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce({ status: 200, body: u });
      await expect(service.getUser('1')).resolves.toEqual(u);
      expect(get).toHaveBeenCalledTimes(2);
    });

    it('gives up after the default 2 retries and throws the last server error', async () => {
      const { get, service } = setup();
      get.mockResolvedValue({ status: 503, body: null });
      const promise = service.getUser('1');
      await expect(promise).rejects.toBeInstanceOf(UserServiceError);
      await expect(promise).rejects.toMatchObject({ message: 'Server error 503', status: 503 });
      expect(get).toHaveBeenCalledTimes(3);
    });

    it('honours a custom maxRetries of 0 by attempting only once', async () => {
      const { get, service } = setup(0);
      get.mockResolvedValue({ status: 500, body: null });
      await expect(service.getUser('1')).rejects.toMatchObject({ message: 'Server error 500', status: 500 });
      expect(get).toHaveBeenCalledTimes(1);
    });

    it('rethrows the original Error when every attempt throws', async () => {
      const { get, service } = setup();
      const boom = new Error('boom');
      get.mockRejectedValue(boom);
      await expect(service.getUser('1')).rejects.toBe(boom);
      expect(get).toHaveBeenCalledTimes(3);
    });

    it('wraps a non-Error rejection in UserServiceError("Request failed")', async () => {
      const { get, service } = setup();
      get.mockRejectedValue('nope');
      const promise = service.getUser('1');
      await expect(promise).rejects.toBeInstanceOf(UserServiceError);
      await expect(promise).rejects.toMatchObject({ message: 'Request failed' });
    });
  });

  describe('listActiveUsers', () => {
    it('returns only active users sorted by name', async () => {
      const { get, service } = setup();
      get.mockResolvedValue({
        status: 200,
        body: [
          user({ id: '1', name: 'Charlie' }),
          user({ id: '2', name: 'Bob', active: false }),
          user({ id: '3', name: 'Alice' }),
        ],
      });
      const result = await service.listActiveUsers();
      expect(result.map((u) => u.name)).toEqual(['Alice', 'Charlie']);
      expect(get).toHaveBeenCalledWith(`${BASE}/users`);
    });

    it('throws UserServiceError with status on a non-200 response', async () => {
      const { get, service } = setup();
      get.mockResolvedValue({ status: 403, body: null });
      const promise = service.listActiveUsers();
      await expect(promise).rejects.toBeInstanceOf(UserServiceError);
      await expect(promise).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('createUser', () => {
    it('rejects an email without @ and does not call post', async () => {
      const { post, service } = setup();
      await expect(service.createUser({ email: 'invalid', name: 'Alice' })).rejects.toThrow('invalid email');
      expect(post).not.toHaveBeenCalled();
    });

    it('rejects a name shorter than 2 characters after trimming', async () => {
      const { post, service } = setup();
      await expect(service.createUser({ email: 'a@example.com', name: ' a ' })).rejects.toThrow('name too short');
      expect(post).not.toHaveBeenCalled();
    });

    it('posts the input and returns the created user on 201', async () => {
      const { post, service } = setup();
      const input = { email: 'a@example.com', name: 'Alice' };
      const created = user();
      post.mockResolvedValue({ status: 201, body: created });
      await expect(service.createUser(input)).resolves.toEqual(created);
      expect(post).toHaveBeenCalledWith(`${BASE}/users`, input);
    });

    it('throws a conflict error with status 409 on duplicate email', async () => {
      const { post, service } = setup();
      post.mockResolvedValue({ status: 409, body: null });
      const promise = service.createUser({ email: 'a@example.com', name: 'Alice' });
      await expect(promise).rejects.toMatchObject({ status: 409 });
      await expect(promise).rejects.toThrow('a@example.com');
    });

    it('throws UserServiceError for other non-201 statuses such as 500 without retrying', async () => {
      const { post, service } = setup();
      post.mockResolvedValue({ status: 500, body: null });
      const promise = service.createUser({ email: 'a@example.com', name: 'Alice' });
      await expect(promise).rejects.toBeInstanceOf(UserServiceError);
      await expect(promise).rejects.toMatchObject({ status: 500 });
      expect(post).toHaveBeenCalledTimes(1);
    });
  });
});
