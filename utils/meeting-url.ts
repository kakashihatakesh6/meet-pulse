import { MeetingPlatform } from '../types/meeting';

const GOOGLE_MEET_REGEX = /https?:\/\/meet\.google\.com\/[a-z0-9-]+/i;
const ZOOM_REGEX = /https?:\/\/([a-z0-9-]+\.)?zoom\.us\/(j|my)\/[a-z0-9?=_&.-]+/i;
const TEAMS_REGEX = /https?:\/\/teams\.(microsoft\.com|live\.com)\/[a-z0-9/_?=&.-]+/i;
const WEBEX_REGEX = /https?:\/\/([a-z0-9-]+\.)?webex\.com\/[a-z0-9/_?=&.-]+/i;
const SLACK_REGEX = /https?:\/\/([a-z0-9-]+\.)?slack\.com\/[a-z0-9/_?=&.-]+/i;
const GENERAL_URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/i;

export interface ExtractedMeetingLink {
  url: string;
  platform: MeetingPlatform;
  label: string;
  iconName: string;
}

/**
 * Identifies the platform type from a given URL
 */
export function identifyPlatform(url?: string): MeetingPlatform {
  if (!url) return 'none';
  if (GOOGLE_MEET_REGEX.test(url)) return 'google_meet';
  if (ZOOM_REGEX.test(url)) return 'zoom';
  if (TEAMS_REGEX.test(url)) return 'teams';
  if (WEBEX_REGEX.test(url)) return 'webex';
  if (SLACK_REGEX.test(url)) return 'slack';
  if (GENERAL_URL_REGEX.test(url)) return 'other';
  return 'none';
}

/**
 * Extracts the primary meeting video URL from multiple possible sources
 * (direct url, hangoutLink, conferenceData entryPoints, location string, or description text)
 */
export function extractMeetingLink(options: {
  directUrl?: string;
  hangoutLink?: string;
  conferenceUri?: string;
  location?: string;
  description?: string;
}): ExtractedMeetingLink | null {
  const candidates: string[] = [];

  if (options.directUrl) candidates.push(options.directUrl);
  if (options.hangoutLink) candidates.push(options.hangoutLink);
  if (options.conferenceUri) candidates.push(options.conferenceUri);
  if (options.location) candidates.push(options.location);
  if (options.description) candidates.push(options.description);

  for (const text of candidates) {
    if (!text) continue;

    // Check Google Meet first
    const meetMatch = text.match(GOOGLE_MEET_REGEX);
    if (meetMatch) {
      return {
        url: meetMatch[0],
        platform: 'google_meet',
        label: 'Google Meet',
        iconName: 'video',
      };
    }

    // Check Zoom
    const zoomMatch = text.match(ZOOM_REGEX);
    if (zoomMatch) {
      return {
        url: zoomMatch[0],
        platform: 'zoom',
        label: 'Zoom',
        iconName: 'videocam',
      };
    }

    // Check Teams
    const teamsMatch = text.match(TEAMS_REGEX);
    if (teamsMatch) {
      return {
        url: teamsMatch[0],
        platform: 'teams',
        label: 'Microsoft Teams',
        iconName: 'people',
      };
    }

    // Check Webex
    const webexMatch = text.match(WEBEX_REGEX);
    if (webexMatch) {
      return {
        url: webexMatch[0],
        platform: 'webex',
        label: 'Cisco Webex',
        iconName: 'globe',
      };
    }

    // Check Slack
    const slackMatch = text.match(SLACK_REGEX);
    if (slackMatch) {
      return {
        url: slackMatch[0],
        platform: 'slack',
        label: 'Slack Huddle',
        iconName: 'chatbubbles',
      };
    }

    // Fallback to general URL if in directUrl or location
    if (text === options.directUrl || text === options.location) {
      const generalMatch = text.match(GENERAL_URL_REGEX);
      if (generalMatch) {
        return {
          url: generalMatch[0],
          platform: 'other',
          label: 'Join Meeting',
          iconName: 'link',
        };
      }
    }
  }

  return null;
}

/**
 * Returns UI styling info for a given platform
 */
export function getPlatformDisplayInfo(platform: MeetingPlatform): {
  label: string;
  iconName: string;
  colorKey: 'meet' | 'zoom' | 'teams' | 'primary' | 'textMuted';
} {
  switch (platform) {
    case 'google_meet':
      return { label: 'Google Meet', iconName: 'logo-google', colorKey: 'meet' };
    case 'zoom':
      return { label: 'Zoom', iconName: 'videocam', colorKey: 'zoom' };
    case 'teams':
      return { label: 'Teams', iconName: 'people', colorKey: 'teams' };
    case 'webex':
      return { label: 'Webex', iconName: 'globe', colorKey: 'primary' };
    case 'slack':
      return { label: 'Slack', iconName: 'chatbubbles', colorKey: 'primary' };
    case 'other':
      return { label: 'Video Call', iconName: 'link', colorKey: 'primary' };
    default:
      return { label: 'In Person', iconName: 'location-outline', colorKey: 'textMuted' };
  }
}
