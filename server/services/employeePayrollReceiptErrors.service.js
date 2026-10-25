// All database/Cloudinary details stay in server logs, not API responses.
export const signedReceiptErrorResponse = (error) => {
  if (error?.code === 'ER_NO_SUCH_TABLE' || Number(error?.errno) === 1146) return {
    status: 503, code: 'SALARY_RECEIPTS_SETUP_REQUIRED',
    message: 'Salary receipts are not ready. Ask your administrator to install the signed-receipts database update.',
  };
  if (error?.code === 'ER_BAD_FIELD_ERROR' || Number(error?.errno) === 1054) return {
    status: 503, code: 'SALARY_RECEIPTS_SCHEMA_MISMATCH',
    message: 'Salary receipts need a database update. Please contact your administrator.',
  };
  if (error?.statusCode) return { status: error.statusCode, code: error.code || 'SALARY_RECEIPTS_REQUEST_FAILED', message: error.message };
  return { status: 500, code: 'SALARY_RECEIPTS_UNAVAILABLE', message: 'Could not load salary receipts. Please try again or contact your administrator.' };
};
