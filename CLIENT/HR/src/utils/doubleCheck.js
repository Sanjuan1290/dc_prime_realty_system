export const isDoubleCheckCancelled = (error) => error?.code === 'REVIEW_CANCELLED' || Number(error?.status) === 499
export const getDoubleCheckNotice = (error, fallbackMessage = 'The action could not be completed.') => ({
  type: isDoubleCheckCancelled(error) ? 'info' : 'error',
  message: isDoubleCheckCancelled(error) ? 'Change cancelled. Nothing was saved.' : error?.message || fallbackMessage,
})
