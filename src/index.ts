import { ApolloServer, ApolloServerOptionsWithTypeDefs, BaseContext } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { extend, map, reduce } from 'lodash';
import { Db } from './db';
import { entityToResolverImplementations, yamlToJson, entitiesToGraphQLTypeDefinitions } from './utils';

/**
 * Start Grockery GraphQL server.
 * @param param0
 */
export const start = async ({ yaml, port = 4200 }: { yaml: string; port?: number }) => {
  const { dbConfig, entities } = yamlToJson(yaml);
  const typeDefs = entitiesToGraphQLTypeDefinitions(entities);
  const db = await Db.getInstance(dbConfig.filepath);

  // remove database
  if (dbConfig.resetOnStart) {
    await db.reset();
  }

  // get Apollo GraphQL resolvers
  const resolverImplementations = await Promise.all(
    map(entities, (entity) => entityToResolverImplementations(dbConfig, entity)),
  );
  const queryImplementations = map(resolverImplementations, (resolverImplementation) => resolverImplementation.queries);
  const mutationImplementations = map(
    resolverImplementations,
    (resolverImplementation) => resolverImplementation.mutation,
  );

  // create a single object of resolvers
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

  const { url } = await startStandaloneServer(_server, { listen: { port } });
  console.log(`🚀 Grockery server listening at: ${url}`);
};
