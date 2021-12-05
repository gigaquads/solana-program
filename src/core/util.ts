import 'reflect-metadata';

/**
 * A decorator that associates the decorated class with a specified "index",
 * used when routing the instruction in the on-chain Solana program.
 * @param {number} index - Integer index to tag the decorated class with.
 * @return {Function} - A new constructor.
 */
export function tag(index: number): Function {
  return function (constructor: Function) {
    Reflect.defineMetadata('tag', index, constructor);
  };
}

/**
 * A decorator that registers a property declared on a class as a serializable
 * field, targeting a specific Rust datatype, like u64, etc.
 * @param {string | Array<string>} type - Rust type name, like 'u8' (or ['u8']
 * for array thereof)
 * @param {(x: any) => any | null} adaptor - function that takes the raw
 * property and converts it to a datatype ready for serializing via Borsh.
 * @return {Function} - Decorated instance property.
 */
export function field(
  type: string | Array<string>,
  // eslint-disable-next-line no-unused-vars
  adaptor: ((x: any) => any) | null = null,
): Function {
  return function (target: {} | any, name: PropertyKey): any {
    // register field with borsh schema
    let schema = Reflect.getMetadata('schema', target.constructor);
    if (!schema) {
      schema = { fields: [], kind: 'struct', dependencies: new Set() };
      Reflect.defineMetadata('schema', schema, target.constructor);
    }
    schema.fields.push([name, type]);

    // register adaptor (a function that translates property value into datatype
    // understood by Borsh, like PublicKey -> Uint8Array)
    let adaptors = Reflect.getMetadata('adaptors', target.constructor);
    if (!adaptors) {
      adaptors = {};
      Reflect.defineMetadata('adaptors', adaptors, target.constructor);
    }
    if (adaptor !== null) {
      adaptors[name] = adaptor;
    }
  };
}
