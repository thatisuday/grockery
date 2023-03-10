import { ApolloServerOptionsWithTypeDefs, BaseContext } from '@apollo/server';
import yaml from 'js-yaml';
import { assign, extend, map, propertyOf } from 'lodash';
import { plural } from 'pluralize';
import { faker } from '@faker-js/faker';
import { JsonDB, Config } from 'node-json-db';
import fs from 'fs-extra';
import path from 'path';
import { eachOf, eachOfSeries, eachSeries } from 'async';

const users = new Array(10).fill(null).map((_val, index) => ({
  id: `${index + 1}`,
  name: faker.name.fullName(),
  age: faker.datatype.number({ min: 10, max: 100 }),
}));

/**
 * This is a database configuration for mock db.
 */
type TDatabaseConfig = {
  filepath: string;
  resetOnStart: boolean;
};

/**
 * This is a GraphQL object type representation.
 */
type TEntity = {
  entity: string;
  properties: { propName: string; propType: string }[];
};

/**
 * Pase YAML string into an JSON object.
 * @param data - YAML string
 * @returns - JSON object
 */
export const yamlToJson = (
  data: string,
): {
  db: TDatabaseConfig;
  entities: TEntity[];
} => {
  const yamlObject = yaml.load(data) as Record<string, Record<string, any>>;

  const entities = map(yamlObject.entities, (props, entity) => {
    const properties = map(props, (propType, propName) => ({ propName, propType }));

    // append `id` property by default
    properties.push({
      propName: 'id',
      propType: 'ID',
    });

    return {
      entity,
      properties,
    };
  });

  return {
    db: {
      filepath: yamlObject.db?.filepath,
      resetOnStart: yamlObject.db?.resetOnStart,
    },
    entities,
  };
};

/**
 * Convert entity representation to GraphQL type definition.
 * @param entity - TEntity object
 * @returns - GraphQL type definition
 */
export const entityToGraphQLType = (entity: TEntity): string => {
  return `type ${entity.entity} {
    ${entity.properties.map((property) => `${property.propName}: ${property.propType}`).join(', ')}
  }`;
};

/**
 * Return GraphQL queries string from entity representations.
 * @param entity - TEntity object
 * @param config - additional config to generate GraphQL queries string
 * @returns - string
 */
export const entityToResolverDefinitions = (
  entity: TEntity,
): {
  queries: string;
  mutations: string;
} => {
  const entityPluralName = plural(entity.entity);
  const paramsString = entity.properties.map((property) => `${property.propName}: ${property.propType}`).join(', ');

  return {
    queries: `
      get${entityPluralName}: [${entity.entity}],
      get${entity.entity}(id: ID): ${entity.entity},
    `,
    mutations: `
      add${entity.entity}(${paramsString}): ${entity.entity},
      update${entity.entity}(${paramsString}): ${entity.entity},
      delete${entity.entity}(id: ID): ${entity.entity},
    `,
  };
};

export const entitiesToResolverImplementations = (
  entity: TEntity,
): {
  queries: ApolloServerOptionsWithTypeDefs<BaseContext>['resolvers'];
  mutation: ApolloServerOptionsWithTypeDefs<BaseContext>['resolvers'];
} => {
  const entityPluralName = plural(entity.entity);

  return {
    queries: {
      [`get${entityPluralName}`]: () => users,
      [`get${entity.entity}`]: (_, args) => {
        return users.find((user) => user.id === args.id);
      },
    },
    mutation: {
      [`add${entity.entity}`]: (_, args) => users[0],
      [`update${entity.entity}`]: (_, args) => {
        return users.find((user) => user.id === args.id);
      },
      [`delete${entity.entity}`]: (_, args) => users[0],
    },
  };
};

export const initializeDatabaseEntities = async ({
  dbConfig,
  entities,
}: {
  dbConfig: TDatabaseConfig;
  entities: TEntity[];
}): Promise<JsonDB> => {
  const dbFilePath = path.resolve(process.cwd(), dbConfig.filepath);

  // remove mock database file
  if (dbConfig.resetOnStart) {
    await fs.remove(dbFilePath);
  }

  const db = new JsonDB(new Config(dbFilePath, true, true, '/'));

  // initialize entities
  await Promise.all(entities.map((entity) => db.push(`/${entity.entity}`, [])));

  return db;
};
