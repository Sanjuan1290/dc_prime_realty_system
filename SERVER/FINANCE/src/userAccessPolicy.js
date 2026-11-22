import {problem} from './domain.js';

/** Finance users must not change their own role or enabled/disabled status. */
export function assertNotSelfAccessChange(targetUserId, actorUserId) {
  if (String(targetUserId) === String(actorUserId)) {
    throw problem(
      'SELF_ACCESS_CHANGE',
      'You cannot change your own Finance role or account status. Ask another Finance Admin to update your access.',
      403,
    );
  }
}
