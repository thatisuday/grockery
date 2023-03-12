import fs from 'fs-extra';
import { assign, remove, find, set } from 'lodash';
import { faker } from '@faker-js/faker';

export class Db {
  // path to store the mock database JSON file
  private filepath: string;

  constructor(filepath: string) {
    this.filepath = filepath;
  }

  /**
   * Return all items belonging to an entity.
   * @param entity
   * @returns
   */
  async getAll(entity: string) {
    const json = await fs.readJSON(this.filepath);
    const items = json[entity];

    if (!items?.length) {
      return [];
    }

    return items;
  }

  /**
   * Return an item belonging to an entity with given id.
   * @param entity
   * @returns
   */
  async get(entity: string, id: string) {
    const json = await fs.readJSON(this.filepath);
    const item = find(json[entity], { id });

    if (!item) {
      throw Error(`Cannot find ${entity} item with id ${id}.`);
    }

    return item;
  }

  /**
   * Add a new entity item in the database.
   * @param entity
   * @param data
   * @returns
   */
  async add(entity: string, data: any) {
    const json = await fs.readJSON(this.filepath);

    if (!json[entity]) {
      set(json, entity, []);
    }

    const item = { ...data, id: faker.datatype.uuid() };

    json[entity].push(item);
    await fs.writeJSON(this.filepath, json);

    return item;
  }

  /**
   * Update an entity item data.
   * @param entity
   * @param id
   * @param data
   * @returns
   */
  async update(entity: string, id: string, data: any) {
    const json = await fs.readJSON(this.filepath);
    const item = find(json[entity], { id });

    if (!item) {
      throw Error(`Cannot find ${entity} item with id ${id}.`);
    }

    assign(item, data);
    await fs.writeJSON(this.filepath, json);

    return item;
  }

  /**
   * Remove entity item from the database.
   * @param entity
   * @param id
   * @returns
   */
  async remove(entity: string, id: string) {
    const json = await fs.readJSON(this.filepath);
    const items = remove(json[entity], { id });

    if (!items?.[0]) {
      throw Error(`Cannot find ${entity} item with id ${id}.`);
    }

    await fs.writeJSON(this.filepath, json);
    return items?.[0];
  }

  /**
   * Clean database file (remove all entries).
   * @param filepath
   */
  async reset() {
    await fs.writeJSON(this.filepath, {});
  }

  /*-------------------------*/

  // return singleton instance
  private static __instance: Db;

  static async getInstance(filepath: string): Promise<Db> {
    if (!this.__instance) {
      await fs.ensureFile(filepath);
      const json = await fs.readFile(filepath, { encoding: 'utf-8' });

      if (!json) {
        await fs.writeJSON(filepath, {});
      }

      this.__instance = new Db(filepath);
    }

    /*---------------*/

    return this.__instance;
  }
}
