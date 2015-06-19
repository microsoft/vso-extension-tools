
export interface IWebApiArrayResult {
    count: number;
    value: any[];
}

/**
 * Metadata for deserializing an enum field on a contract/type
 */
export interface ContractEnumMetadata {
    enumValues?: { [name: string]: number; };
}

/**
 * Metadata for deserializing a particular field on a contract/type
 */
export interface ContractFieldMetadata {
    isArray?: boolean;
    isDate?: boolean;
    enumType?: ContractEnumMetadata;
    typeInfo?: ContractMetadata;

    isDictionary?: boolean;
    dictionaryKeyIsDate?: boolean;
    dictionaryValueIsDate?: boolean;
    dictionaryKeyEnumType?: ContractEnumMetadata;
    dictionaryValueEnumType?: ContractEnumMetadata;
    dictionaryValueTypeInfo?: ContractMetadata;
    dictionaryValueFieldInfo?: ContractFieldMetadata;
}

/**
 * Metadata required for deserializing a given type
 */
export interface ContractMetadata {
    fields?: { [fieldName: string]: ContractFieldMetadata; };
}

/**
 * Module for handling serialization and deserialization of data contracts
 * (contracts sent from the server using the VSO default REST api serialization settings)
 */
export module ContractSerializer {

    let _legacyDateRegExp: RegExp;

    /**
     * Process a contract in its raw form (e.g. date fields are Dates, and Enums are numbers) and
     * return a pure JSON object that can be posted to REST endpoint.
     *
     * @param data The object to serialize
     * @param contractMetadata The type info/metadata for the contract type being serialized
     * @param preserveOriginal If true, don't modify the original object. False modifies the original object (the return value points to the data argument).
     */
    export function serialize(data: any, contractMetadata: ContractMetadata, preserveOriginal: boolean = true) {
        if (data && contractMetadata) {
            if (_.isArray(data)) {
                return _getTranslatedArray(data, contractMetadata, true, preserveOriginal);
            }
            else {
                return _getTranslatedObject(data, contractMetadata, true, preserveOriginal);
            }
        }
        else {
            return data;
        }
    }
    
    /**
     * Process a pure JSON object (e.g. that came from a REST call) and transform it into a JS object
     * where date strings are converted to Date objects and enum values are converted from strings into
     * their numerical value.
     *
     * @param data The object to deserialize
     * @param contractMetadata The type info/metadata for the contract type being deserialize
     * @param preserveOriginal If true, don't modify the original object. False modifies the original object (the return value points to the data argument).
     * @param unwrapWrappedCollections If true check for wrapped arrays (REST apis will not return arrays directly as the root result but will instead wrap them in a { values: [], count: 0 } object.
     */
    export function deserialize(data: any, contractMetadata: ContractMetadata, preserveOriginal: boolean = true, unwrapWrappedCollections: boolean = false) {
        if (data) {
            if (unwrapWrappedCollections && _.isArray((<IWebApiArrayResult>data).value)) {
                // Wrapped json array - unwrap it and send the array as the result
                data = (<IWebApiArrayResult>data).value;
            }

            if (contractMetadata) {
                if (_.isArray(data)) {
                    data = _getTranslatedArray(data, contractMetadata, false, preserveOriginal);
                }
                else {
                    data = _getTranslatedObject(data, contractMetadata, false, preserveOriginal);
                }
            }
        }
        return data;
    }

    function _getTranslatedArray(array: any, typeMetadata: ContractMetadata, serialize: boolean, preserveOriginal: boolean) {
        let resultArray: any[] = array;

        let arrayCopy: any[] = [];
        
        for (let i = 0; i < array.length; ++i) {
            let item = array[i];
            let processedItem: any;

            // handle arrays of arrays
            if (_.isArray(item)) {
                processedItem = _getTranslatedArray(item, typeMetadata, serialize, preserveOriginal);
            }
            else {
                processedItem = _getTranslatedObject(item, typeMetadata, serialize, preserveOriginal);
            }

            if (preserveOriginal) {
                arrayCopy.push(processedItem);
                if (processedItem !== item) {
                    resultArray = arrayCopy;
                }
            }
            else {
                array[i] = processedItem;
            }
        }

        return resultArray;
    }

    function _getTranslatedObject(typeObject: any, typeMetadata: ContractMetadata, serialize: boolean, preserveOriginal: boolean) {
        let processedItem = typeObject,
            copiedItem = false;
        
        if (typeObject && typeMetadata.fields) {
            Object.keys(typeMetadata.fields).forEach((fieldName) => {
                let fieldMetadata: ContractFieldMetadata = typeMetadata.fields[fieldName];
                let fieldValue = typeObject[fieldName];
                let translatedValue = _getTranslatedField(fieldValue, fieldMetadata, serialize, preserveOriginal);
                if (fieldValue !== translatedValue) {
                    if (preserveOriginal && !copiedItem) {
                        processedItem = _.assign({}, typeObject);
                        copiedItem = true;
                    }
                    processedItem[fieldName] = translatedValue;
                }
            });
        }

        return processedItem;
    }

    function _getTranslatedField(fieldValue: any, fieldMetadata: ContractFieldMetadata, serialize: boolean, preserveOriginal: boolean) {

        if (!fieldValue) {
            return fieldValue;
        }

        if (fieldMetadata.isArray) {
            if (_.isArray(fieldValue)) {

                let newArray: any[] = [],                    
                    processedArray: any[] = fieldValue;

                for (let index = 0; index < fieldValue.length; ++index) {
                    let arrayValue: any = fieldValue[index];
                    let processedValue = arrayValue;
                    if (fieldMetadata.isDate) {
                        processedValue = _getTranslatedDateValue(arrayValue, serialize);
                    }
                    else if (fieldMetadata.enumType) {
                        processedValue = _getTranslatedEnumValue(fieldMetadata.enumType, arrayValue, serialize);
                    }
                    else if (fieldMetadata.typeInfo) {
                        if (_.isArray(arrayValue)) {
                            processedValue = _getTranslatedArray(arrayValue, fieldMetadata.typeInfo, serialize, preserveOriginal);
                        }
                        else {
                            processedValue = _getTranslatedObject(arrayValue, fieldMetadata.typeInfo, serialize, preserveOriginal);
                        }
                    }

                    if (preserveOriginal) {
                        newArray.push(processedValue);
                        if (processedValue !== arrayValue) {
                            processedArray = newArray;
                        }
                    }
                    else {
                        fieldValue[index] = processedValue;
                    }
                }

                return processedArray;
            }
            else {
                return fieldValue;
            }
        }
        else if (fieldMetadata.isDictionary) {
            let dictionaryModified = false;
            let newDictionary: any = {};
            Object.keys(fieldValue).forEach((key) => {
                let dictionaryValue: any = fieldValue[key];
                let newKey = key,
                    newValue = dictionaryValue;

                if (fieldMetadata.dictionaryKeyIsDate) {
                    newKey = _getTranslatedDateValue(key, serialize);
                }
                else if (fieldMetadata.dictionaryKeyEnumType) {
                    newKey = _getTranslatedEnumValue(fieldMetadata.dictionaryKeyEnumType, key, serialize);
                }

                if (fieldMetadata.dictionaryValueIsDate) {
                    newValue = _getTranslatedDateValue(dictionaryValue, serialize);
                }
                else if (fieldMetadata.dictionaryValueEnumType) {
                    newValue = _getTranslatedEnumValue(fieldMetadata.dictionaryValueEnumType, dictionaryValue, serialize);
                }
                else if (fieldMetadata.dictionaryValueTypeInfo) {
                    newValue = _getTranslatedObject(newValue, fieldMetadata.dictionaryValueTypeInfo, serialize, preserveOriginal);
                }
                else if (fieldMetadata.dictionaryValueFieldInfo) {
                    newValue = _getTranslatedField(dictionaryValue, fieldMetadata.dictionaryValueFieldInfo, serialize, preserveOriginal);
                }

                newDictionary[newKey] = newValue;
                if (key !== newKey || dictionaryValue !== newValue) {
                    dictionaryModified = true;
                }
            });
            return dictionaryModified ? newDictionary : fieldValue;
        }
        else {
            if (fieldMetadata.isDate) {
                return _getTranslatedDateValue(fieldValue, serialize);
            }
            else if (fieldMetadata.enumType) {
                return _getTranslatedEnumValue(fieldMetadata.enumType, fieldValue, serialize);
            }
            else if (fieldMetadata.typeInfo) {
                return _getTranslatedObject(fieldValue, fieldMetadata.typeInfo, serialize, preserveOriginal);
            }
            else {
                return fieldValue;
            }
        }
    }

    function _getTranslatedEnumValue(enumType: ContractEnumMetadata, valueToConvert: any, serialize: boolean): any {
        if (serialize && typeof valueToConvert === "number") {
            // Serialize: number --> String
            // Because webapi handles the numerical value for enums, there is no need to convert to string.
            // Let this fall through to return the numerical value.
        }
        else if (!serialize && typeof valueToConvert === "string") {
            // Deserialize: String --> number
            let result = 0;
            if (valueToConvert) {
                valueToConvert.split(",").forEach((valuePart) => {
                    let enumName = _.trim(valuePart) || "";
                    if (enumName) {
                        let resultPart = enumType.enumValues[enumName];

                        if (!resultPart) {
                            // No matching enum value. Try again but case insensitive
                            let lowerCaseEnumName = enumName.toLowerCase();
                            if (lowerCaseEnumName !== enumName) {
                                Object.keys(enumType.enumValues).forEach((n) => {
                                    let v = enumType.enumValues[n];
                                    if (n.toLowerCase() === lowerCaseEnumName) {
                                        resultPart = v;
                                        return false;
                                    }
                                });
                            }
                        }

                        if (resultPart) {
                            result |= resultPart;
                        }
                    }
                });
            }
            return result;
        }
        return valueToConvert;
    }

    function _getTranslatedDateValue(valueToConvert: any, serialize: boolean): any {
        if (serialize && (valueToConvert instanceof Date) && Date.prototype.toISOString) {
            return (<Date>valueToConvert).toISOString();
        }
        else if (!serialize && typeof valueToConvert === "string") {
            // Deserialize: String --> Date
            let dateValue = new Date(valueToConvert);
            return dateValue;
        }
        return valueToConvert;
    }
}