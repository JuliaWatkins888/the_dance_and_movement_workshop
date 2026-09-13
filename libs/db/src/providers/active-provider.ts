import { DbProvider } from '../contracts/db-provider.contract';
import { mongoProvider } from './mongo/mongo.provider';

export const activeProvider: DbProvider = mongoProvider;
