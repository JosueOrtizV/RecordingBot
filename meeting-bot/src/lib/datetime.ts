import moment from 'moment-timezone';
import { Logger } from 'winston';

export const getTimeString = (timezone: string, logger: Logger, date?: Date | number | string) => {
  try {
    if (!moment.tz.zone(timezone)) {
      throw new Error(`Unsupported timezone: ${timezone}`);
    }

    return moment(date || new Date()).tz(timezone).format('h:mma MMM DD YYYY');
  } catch (error) {
    logger.warn('Using UTC time, found an invalid timezone', timezone, error);
    return moment(date || new Date()).format('h:mma MMM DD YYYY');
  }
};
