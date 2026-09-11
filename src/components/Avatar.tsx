import { useState } from 'react';
import type { KinUser } from '../types';
import './avatar.css';

export function Avatar({ user }: { user: Pick<KinUser, 'displayName' | 'photoURL'> | null }) {
  const [failedURL, setFailedURL] = useState<string | null>(null);
  const photoURL = user?.photoURL;
  return photoURL && photoURL !== failedURL
    ? <img className="avatar-image" src={photoURL} alt="" referrerPolicy="no-referrer" onError={() => setFailedURL(photoURL)} />
    : <span aria-hidden="true">{user?.displayName?.trim().slice(0, 1).toUpperCase() || 'K'}</span>;
}
