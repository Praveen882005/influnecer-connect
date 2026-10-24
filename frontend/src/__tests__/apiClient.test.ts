import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '../api/client';
import { ApiClientError } from '../api/types';

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient('http://test-api.example.com/api/');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should normalize base URL and strip trailing slashes', () => {
    expect(client.getBaseUrl()).toBe('http://test-api.example.com/api');
  });

  it('should successfully execute GET requests and return parsed JSON', async () => {
    const mockData = { id: 1, name: 'Sample Item' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockData,
    } as Response);

    const result = await client.get<{ id: number; name: string }>('/items');
    expect(result).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://test-api.example.com/api/items',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should inject query parameters into URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    } as Response);

    await client.get('/items', { params: { search: 'tech', page: 2 } });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://test-api.example.com/api/items?search=tech&page=2',
      expect.anything()
    );
  });

  it('should attach Bearer authorization token if tokenGetter provided', async () => {
    client.setTokenGetter(() => 'mock_secret_token');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ authenticated: true }),
    } as Response);

    await client.get('/secure/profile');
    const calledHeaders = (vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.headers) as Headers;
    expect(calledHeaders.get('Authorization')).toBe('Bearer mock_secret_token');
  });

  it('should extract FastAPI 422 field errors and populate ApiClientError', async () => {
    const errorPayload = {
      detail: [
        { loc: ['body', 'email'], msg: 'value is not a valid email address', type: 'value_error' },
        { loc: ['body', 'budget'], msg: 'ensure this value is greater than 0', type: 'value_error' },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => errorPayload,
    } as Response);

    try {
      await client.post('/campaigns', {});
      expect.fail('Should have thrown an ApiClientError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiClientError);
      if (err instanceof ApiClientError) {
        expect(err.status).toBe(422);
        expect(err.fieldErrors['email']).toBe('value is not a valid email address');
        expect(err.fieldErrors['budget']).toBe('ensure this value is greater than 0');
      }
    }
  });

  it('should identify 404 and network errors as unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Failed to fetch'));

    await expect(client.get('/unreachable')).rejects.toSatisfy((err) => {
      return err instanceof ApiClientError && err.isUnavailable === true && err.status === 0;
    });
  });
});
