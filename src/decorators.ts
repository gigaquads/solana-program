/**
 * A decorator that registers a class as a Rust enum variant.
 *
 * @param {number} index - Integer offset of the variant in the Rust enum to
 * which the variant belows.
 * @return {Function} - Constructor that stores variant index in class metadata.
 */
export function variant(index: number) {
  return function(constructor: Function) {
    Reflect.defineMetadata('variant', index, constructor);
  };
}

/**
 * A decorator that registers a property declared on a class as a serializable
 * field, targeting a specific Rust datatype, like u64, etc.
 *
 * @param {string} type - Rust type, like u8, etc., that we want to
 * (de)serialize this field to/from.
 * @return {Function} - The modified property.
 */
export function field(type: string | Array<string>) {
  return function(target: {} | any, name: PropertyKey): any {
    let schema = Reflect.getMetadata('schema', target.constructor);
    if (!schema) {
      schema = {fields: [], kind: 'struct', dependencies: new Set()};
      Reflect.defineMetadata('schema', schema, target.constructor);
    }
    schema.fields.push([name, type]);
  };
}
