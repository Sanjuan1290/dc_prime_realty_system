const isProduction = process.env.NODE_ENV === 'production';

export const getAuthCookieOptions = ({ maxAge } = {}) => {
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  };

  if (Number.isFinite(Number(maxAge)) && Number(maxAge) > 0) {
    options.maxAge = Number(maxAge);
  }

  return options;
};

export const clearAuthCookie = (res) => {
  res.clearCookie('token', getAuthCookieOptions());
};
