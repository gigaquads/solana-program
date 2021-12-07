import 'reflect-metadata';

/**
 * 1. Custom pre-serialization logic, convering the native type declared on a
 * property into another type that Borsh understands and can serialize.
 *
 * 2. Custom post-deserlization logic that converst the raw deserialized value
 * into the type declared on the property. This is the inverse of onSerialize.
 */
export type FieldAdaptor = {
  // eslint-disable-next-line no-unused-vars
  onSerialize?: (obj: any) => any;
  // eslint-disable-next-line no-unused-vars
  onDeserialize?: (obj: any) => any;
};

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
 * @param {string | [string] | [string, number]} type - Rust type name, like
 * 'u8' (or ['u8'] for array thereof)
 * @param {(x: any) => any | null} adaptor - function that takes the raw
 * property and converts it to a datatype ready for serializing via Borsh.
 * @return {Function} - Decorated instance property.
 */
export function field(
  type: string | [string] | [string, number],
  // eslint-disable-next-line no-unused-vars
  adaptor?: FieldAdaptor,
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
