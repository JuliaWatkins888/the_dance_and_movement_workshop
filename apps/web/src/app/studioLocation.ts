// The studio's own location - shown on the Contact page and on events held at the studio.
export const STUDIO_NAME = 'The Dance and Movement Workshop';
export const STUDIO_ADDRESS = '64007 Van Dyke Rd. Ste. 2, Washington, MI 48095';

export const googleMapsLink = (address: string): string => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
