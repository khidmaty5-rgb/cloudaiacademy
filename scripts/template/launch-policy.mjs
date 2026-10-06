// Public identifiers only. Never accept credentials or database contents here.
const protectedProject = 'studio-3170120655-4bab7';
export function auditLaunch({ identity, firebaseTarget, expectedProject, clientProject, serverProject, newAcademy = true }) {
  const errors = [];
  if (!expectedProject || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(expectedProject)) errors.push('Provide the intended Firebase project ID explicitly.');
  if (!firebaseTarget || firebaseTarget !== expectedProject) errors.push('The Firebase CLI default target does not match the intended project.');
  if (!clientProject || clientProject !== expectedProject) errors.push('The client Firebase project is missing or does not match the intended project.');
  if (!serverProject || serverProject !== expectedProject) errors.push('The server Firebase project is missing or does not match the intended project.');
  if (newAcademy) {
    if ([firebaseTarget, expectedProject, clientProject, serverProject].includes(protectedProject)) errors.push('A new academy must not use the CloudAI production Firebase project.');
    let host = '';
    try { host = new URL(identity?.siteUrl).hostname; } catch { errors.push('The academy site URL is invalid.'); }
    if (host === 'cloudaiacademy.ca' || host.endsWith('.cloudaiacademy.ca') || host === 'cloudaiacademy.vercel.app') errors.push('Replace the copied CloudAI domain before launching a new academy.');
    if (identity?.name === 'CloudAI Academy') errors.push('Replace the copied academy name before launching a new academy.');
    for (const field of ['contactEmail', 'journalEmail']) {
      if (typeof identity?.[field] === 'string' && identity[field].toLowerCase().endsWith('@cloudaiacademy.ca')) errors.push('Replace copied CloudAI contact addresses.');
    }
  }
  return [...new Set(errors)];
}
