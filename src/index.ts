import { ApolloServer, ApolloServerOptionsWithTypeDefs, BaseContext } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { extend, map, reduce } from 'lodash';
import {
  entityToResolverDefinitions,
  entityToGraphQLType,
  entitiesToResolverImplementations,
  yamlToJson,
  initializeDatabaseEntities,
} from './utils';

import { JsonDB, Config } from 'node-json-db';

export const start = async ({ yaml, port = 4200 }: { yaml: string; port?: number }) => {
  const { db, entities } = yamlToJson(yaml);
  const graphQLTypes = map(entities, (entity) => entityToGraphQLType(entity));

  const resolverDefinitions = map(entities, entityToResolverDefinitions);
  const queries = map(resolverDefinitions, (resolverDefinition) => resolverDefinition.queries);
  const mutations = map(resolverDefinitions, (resolverDefinition) => resolverDefinition.mutations);

  const typeDefs = `
    ${graphQLTypes.join('\n')}

    type Query {
      ${queries.join('\n')}
    }

    type Mutation {
      ${mutations.join('\n')}
    }
  `;

  const resolverImplementations = map(entities, entitiesToResolverImplementations);
  const queryImplementations = map(resolverImplementations, (resolverImplementation) => resolverImplementation.queries);
  const mutationImplementations = map(
    resolverImplementations,
    (resolverImplementation) => resolverImplementation.mutation,
  );

  const queryResolvers = reduce(
    queryImplementations,
    extend,
  ) as ApolloServerOptionsWithTypeDefs<BaseContext>['resolvers'];
  const mutationResolvers = reduce(
    mutationImplementations,
    extend,
  ) as ApolloServerOptionsWithTypeDefs<BaseContext>['resolvers'];

  const _server = new ApolloServer({
    typeDefs,
    resolvers: {
      Query: queryResolvers,
      Mutation: {
        ...mutationResolvers,
      },
    },
  });

  await initializeDatabaseEntities({
    dbConfig: db,
    entities: entities,
  });

  const { url } = await startStandaloneServer(_server, { listen: { port } });
  console.log(`🚀 Grockery server listening at: ${url}`);
};
