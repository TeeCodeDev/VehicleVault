import { common } from './common.js';
import { vehicles } from './vehicles.js';
import { maintenance } from './maintenance.js';
import { fuel } from './fuel.js';
import { analytics } from './analytics.js';
import { importer } from './importer.js';
import { settings } from './settings.js';
import { notifications } from './notifications.js';
import { documents } from './documents.js';
import { auth } from './auth.js';
import { dashboard } from './dashboard.js';
import { expenses } from './expenses.js';

export const nl = {
  ...common,
  ...vehicles,
  ...maintenance,
  ...fuel,
  ...analytics,
  ...importer,
  ...settings,
  ...notifications,
  ...documents,
  ...auth,
  ...dashboard,
  ...expenses,
};
