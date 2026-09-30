// "Oct 11, 2017". UTC so server and client agree.
export const shortDate = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null;
