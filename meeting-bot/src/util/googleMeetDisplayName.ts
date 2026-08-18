const DEFAULT_GOOGLE_MEET_DISPLAY_NAME = process.env.BOT_DISPLAY_NAME || "Josue's Notetaker";

export const getGoogleMeetDisplayName = (name?: string): string => {
  const displayName = name?.trim() || DEFAULT_GOOGLE_MEET_DISPLAY_NAME;
  return displayName;
};
