export interface HttpResponse<T> {
  status: number;
  body: T;
}

export interface HttpClient {
  get<T>(url: string): Promise<HttpResponse<T>>;
  post<T>(url: string, body: unknown): Promise<HttpResponse<T>>;
}

export interface User {
  id: string;
  email: string;
  name: string;
  active: boolean;
}

export class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`User ${id} not found`);
    this.name = 'UserNotFoundError';
  }
}

export class UserServiceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'UserServiceError';
  }
}

export interface UserServiceOptions {
  baseUrl: string;
  maxRetries?: number;
}

/**
 * Thin client for a remote user API. The HTTP client is injected so the
 * service can be tested without network access.
 */
export class UserService {
  private readonly maxRetries: number;

  constructor(
    private readonly http: HttpClient,
    private readonly options: UserServiceOptions,
  ) {
    if (!options.baseUrl.startsWith('https://')) {
      throw new UserServiceError('baseUrl must use https');
    }
    this.maxRetries = options.maxRetries ?? 2;
  }

  async getUser(id: string): Promise<User> {
    if (id.trim() === '') {
      throw new UserServiceError('id is required');
    }
    const response = await this.withRetry(() =>
      this.http.get<User>(`${this.options.baseUrl}/users/${encodeURIComponent(id)}`),
    );
    if (response.status === 404) {
      throw new UserNotFoundError(id);
    }
    if (response.status !== 200) {
      throw new UserServiceError(`Unexpected status ${response.status}`, response.status);
    }
    return response.body;
  }

  async listActiveUsers(): Promise<User[]> {
    const response = await this.withRetry(() => this.http.get<User[]>(`${this.options.baseUrl}/users`));
    if (response.status !== 200) {
      throw new UserServiceError(`Unexpected status ${response.status}`, response.status);
    }
    return response.body.filter((user) => user.active).sort((a, b) => a.name.localeCompare(b.name));
  }

  async createUser(input: { email: string; name: string }): Promise<User> {
    if (!input.email.includes('@')) {
      throw new UserServiceError('invalid email');
    }
    if (input.name.trim().length < 2) {
      throw new UserServiceError('name too short');
    }
    const response = await this.http.post<User>(`${this.options.baseUrl}/users`, input);
    if (response.status === 409) {
      throw new UserServiceError(`User with email ${input.email} already exists`, 409);
    }
    if (response.status !== 201) {
      throw new UserServiceError(`Unexpected status ${response.status}`, response.status);
    }
    return response.body;
  }

  /** Retries on 5xx responses and network errors, never on 4xx. */
  private async withRetry<T>(call: () => Promise<HttpResponse<T>>): Promise<HttpResponse<T>> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await call();
        if (response.status < 500) {
          return response;
        }
        lastError = new UserServiceError(`Server error ${response.status}`, response.status);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new UserServiceError('Request failed');
  }
}
