const getApiUrl = (url) => `${import.meta.env.VITE_API_URL}${url}`;

const request = async (url, options = {}) => {
  const res = await fetch(getApiUrl(url), {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.message || 'Request failed');
  }

  return data;
};

export const useFetch = async (url) => {
  return request(url);
};

export const useFetchPost = async (url, body = {}) => {
  return request(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

export const useFetchPut = async (url, body = {}) => {
  return request(url, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
};

export const useFetchPatch = async (url, body = {}) => {
  return request(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
};

export const useFetchDelete = async (url) => {
  return request(url, {
    method: 'DELETE',
  });
};


