export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
];

export const GOOGLE_OAUTH_ENDPOINTS = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  userInfoEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
};

export const GOOGLE_API_ENDPOINTS = {
  calendarList: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
  calendarEvents: (calendarId: string) =>
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
  driveFiles: 'https://www.googleapis.com/drive/v3/files',
  sheetsValues: (spreadsheetId: string, range: string) =>
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
  sheetsMetadata: (spreadsheetId: string) =>
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`,
};
