// Offline check: no database connections, provider calls, recipients or secrets.
import {loadHrEnvironment} from '../../SERVER/HR/config/environment.js';
import {payrollUndoEmailSettings} from '../../SERVER/HR/services/payrollUndoEmail.js';
const env={NODE_ENV:'development'};
loadHrEnvironment({env});
try {
  const settings=payrollUndoEmailSettings(env);
  console.log(JSON.stringify({file:'SERVER/HR/.env',undoEmailConfigured:true,testSender:settings.from.includes('resend.dev'),passwordResetUrlRequiredForUndo:false}));
} catch(error) {
  console.error(error.message);process.exitCode=1;
}
