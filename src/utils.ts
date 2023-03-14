import { ApolloServerOptionsWithTypeDefs, BaseContext } from '@apollo/server';
import yaml from 'js-yaml';
import { includes, map, trim } from 'lodash';
import { plural } from 'pluralize';
import path from 'path';
import { Db } from './db';

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
export type TEntity = {
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
  dbConfig: TDatabaseConfig;
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
    dbConfig: {
      filepath: yamlObject.dbConfig?.filepath,
      resetOnStart: yamlObject.dbConfig?.resetOnStart,
    },
    entities,
  };
};

export const entityToGraphQLFields = (
  entity: TEntity,
): {
  typeFields: string[];
  inputFields: string[];
} => {
  const isPropTypeInputType = (propType: string) =>
    !includes(
      ['ID', 'ID!', 'Int', 'Int!', 'Boolean', 'Boolean!', 'String', 'String!', 'JSON', 'JSON!'],
      trim(propType),
    );

  const typeFields = entity.properties.map((property) => `${property.propName}: ${property.propType}`);

  const inputFields = entity.properties
    .filter((property) => property.propName !== 'id')
    .map(
      (property) =>
        `${property.propName}: ${
          isPropTypeInputType(property.propType) ? `${property.propType}Input` : property.propType
        }`,
    );

  return { typeFields, inputFields };
};

/**
 * Convert entity representation to GraphQL type definition.
 * @param entity - TEntity object
 * @returns - GraphQL type definition
 */
export const entityToGraphQLType = (entity: TEntity): string => {
  const { typeFields, inputFields } = entityToGraphQLFields(entity);

  return `
    scalar JSON @specifiedBy(url: "http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf")

    # entity type
    type ${entity.entity} {
      ${typeFields}
    }

    # entity input type
    input ${entity.entity}Input {
      ${inputFields}
    }
  `;
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
  const { inputFields } = entityToGraphQLFields(entity);

  return {
    queries: `
      get${entityPluralName}: [${entity.entity}],
      get${entity.entity}(id: ID!): ${entity.entity},
    `,
    mutations: `
      add${entity.entity}(${inputFields}): ${entity.entity},
      update${entity.entity}(${inputFields}): ${entity.entity},
      delete${entity.entity}(id: ID!): ${entity.entity},
    `,
  };
};

/**
 * Compose GraphQL type definitions (schema).
 * @param entities
 * @returns
 */
export const entitiesToGraphQLTypeDefinitions = (entities: TEntity[]): string => {
  const graphQLTypes = map(entities, (entity) => entityToGraphQLType(entity));

  const resolverDefinitions = map(entities, entityToResolverDefinitions);
  const queries = map(resolverDefinitions, (resolverDefinition) => resolverDefinition.queries);
  const mutations = map(resolverDefinitions, (resolverDefinition) => resolverDefinition.mutations);

  return `
    ${graphQLTypes.join('\n')}

    type Query {
      ${queries.join('\n')}
    }

    type Mutation {
      ${mutations.join('\n')}
    }
  `;
};

/**
 * Return GraphQL resolver implementation for an entity.
 * @param dbConfig
 * @param entity
 * @returns
 */
export const entityToResolverImplementations = async (
  dbConfig: TDatabaseConfig,
  entity: TEntity,
): Promise<{
  queries: ApolloServerOptionsWithTypeDefs<BaseContext>['resolvers'];
  mutation: ApolloServerOptionsWithTypeDefs<BaseContext>['resolvers'];
}> => {
  const entityPluralName = plural(entity.entity);

  const dbFilePath = path.resolve(process.cwd(), dbConfig.filepath);
  const db = await Db.getInstance(dbFilePath);

  return {
    queries: {
      [`get${entityPluralName}`]: async () => await db.getAll(entity.entity),
      [`get${entity.entity}`]: async (_, args) => await db.get(entity.entity, args.id),
    },
    mutation: {
      [`add${entity.entity}`]: async (_, args) => await db.add(entity.entity, args),
      [`update${entity.entity}`]: async (_, args) => await db.update(entity.entity, args.id, args),
      [`delete${entity.entity}`]: async (_, args) => await db.remove(entity.entity, args.id),
    },
  };
};
