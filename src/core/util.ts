import { Keypair, PublicKey } from '@solana/web3.js';
import 'reflect-metadata';
import PDA from './PDA';

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

export type FieldOptions = {
  adaptor?: FieldAdaptor;
  space?: number;
};

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
  type: string | [string, number],
  options: FieldOptions = {},
): Function {
  return function (target: {} | any, name: PropertyKey): any {
    const nameStr = name.toString();
    // register field with borsh schema
    let schema = Reflect.getMetadata('schema', target.constructor);
    if (!schema) {
      schema = { fields: [], kind: 'struct', dependencies: new Set() };
      Reflect.defineMetadata('schema', schema, target.constructor);
      Reflect.defineMetadata('offsets', {}, target.constructor);
      Reflect.defineMetadata('sizes', {}, target.constructor);
      Reflect.defineMetadata('space', 0, target.constructor);
    }

    schema.fields.push([name, type]);

    // register adaptor (a function that translates property value into datatype
    // understood by Borsh, like PublicKey -> Uint8Array)
    let adaptors = Reflect.getMetadata('adaptors', target.constructor);
    if (!adaptors) {
      adaptors = {};
      Reflect.defineMetadata('adaptors', adaptors, target.constructor);
    }
    if (options.adaptor) {
      adaptors[name] = options.adaptor;
    }
    // set manually defined byte space of field value.
    if (!options.space) {
      let inferredSize = inferFieldSize(type);
      if (inferredSize === null) {
        if (typeof type === 'string') {
          // NOTE: if the field is a string, we guess the space required
          // based on the length of the string. Rust stores strings as a usize
          // (64bit int) and a byte vector, with 4 bytes per char.
          inferredSize = 8 + 4 * type.length;
        } else {
          throw Error(
            `could not infer space of field: ` +
              `"${name.toString()}" (type: ${type})`,
          );
        }
      }
      options.space = inferredSize;
    }
    if (options.space < 0) {
      throw Error(`field cannot have negative space: ${name.toString()}`);
    }

    const sizes: { [key: string]: number } = Reflect.getMetadata(
      'sizes',
      target.constructor,
    );
    const offsets: { [key: string]: number } = Reflect.getMetadata(
      'offsets',
      target.constructor,
    );

    if (schema.fields.length == 1) {
      offsets[nameStr] = 0;
    } else {
      offsets[nameStr] = Object.values(sizes).reduce((a, b) => a + b);
    }

    sizes[nameStr] = options.space;

    const space: number = Reflect.getMetadata('space', target.constructor);
    Reflect.defineMetadata('space', space + options.space, target.constructor);
  };
}

/**
 *
 * @param fieldDef
 * @returns
 */
function inferFieldSize(fieldDef: string | [string, number]): number | null {
  const getSizeOf = (typeName: string): number | null => {
    switch (typeName.toLocaleLowerCase()) {
      case 'u8':
      case 'i8':
      case 'bool':
        return 1;
      case 'u16':
      case 'i16':
        return 2;
      case 'u32':
      case 'i32':
      case 'f32':
        return 4;
      case 'u64':
      case 'i64':
      case 'f64':
      case 'usize':
        return 8;
      default:
        return null;
    }
  };
  if (typeof fieldDef === 'string') {
    return getSizeOf(fieldDef);
  } else {
    const unitSize = getSizeOf(fieldDef[0])!;
    return unitSize * fieldDef[1];
  }
}

/**
 *
 * @param obj
 * @returns
 */
export function resolvePublicKey(obj: any): PublicKey {
  if (obj instanceof PublicKey) {
    return obj;
  } else if (obj instanceof PDA) {
    return obj.key;
  } else if (obj instanceof Keypair) {
    return obj.publicKey;
  } else if (typeof obj === 'string' || obj instanceof Buffer) {
    return new PublicKey(obj);
  } else if (obj && obj.key instanceof PublicKey) {
    return obj.key;
  } else {
    throw Error(`could not convert object ${obj} to PublicKey`);
  }
}
