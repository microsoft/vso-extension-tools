var _ = require("lodash");
var ContractSerializer;
(function (ContractSerializer) {
    var _legacyDateRegExp;
    function serialize(data, contractMetadata, preserveOriginal) {
        if (preserveOriginal === void 0) { preserveOriginal = true; }
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
    ContractSerializer.serialize = serialize;
    function deserialize(data, contractMetadata, preserveOriginal, unwrapWrappedCollections) {
        if (preserveOriginal === void 0) { preserveOriginal = true; }
        if (unwrapWrappedCollections === void 0) { unwrapWrappedCollections = false; }
        if (data) {
            if (unwrapWrappedCollections && _.isArray(data.value)) {
                data = data.value;
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
    ContractSerializer.deserialize = deserialize;
    function _getTranslatedArray(array, typeMetadata, serialize, preserveOriginal) {
        var resultArray = array;
        var arrayCopy = [];
        for (var i = 0; i < array.length; ++i) {
            var item = array[i];
            var processedItem = void 0;
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
    function _getTranslatedObject(typeObject, typeMetadata, serialize, preserveOriginal) {
        var processedItem = typeObject, copiedItem = false;
        if (typeObject && typeMetadata.fields) {
            Object.keys(typeMetadata.fields).forEach(function (fieldName) {
                var fieldMetadata = typeMetadata.fields[fieldName];
                var fieldValue = typeObject[fieldName];
                var translatedValue = _getTranslatedField(fieldValue, fieldMetadata, serialize, preserveOriginal);
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
    function _getTranslatedField(fieldValue, fieldMetadata, serialize, preserveOriginal) {
        if (!fieldValue) {
            return fieldValue;
        }
        if (fieldMetadata.isArray) {
            if (_.isArray(fieldValue)) {
                var newArray = [], processedArray = fieldValue;
                for (var index = 0; index < fieldValue.length; ++index) {
                    var arrayValue = fieldValue[index];
                    var processedValue = arrayValue;
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
            var dictionaryModified = false;
            var newDictionary = {};
            Object.keys(fieldValue).forEach(function (key) {
                var dictionaryValue = fieldValue[key];
                var newKey = key, newValue = dictionaryValue;
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
    function _getTranslatedEnumValue(enumType, valueToConvert, serialize) {
        if (serialize && typeof valueToConvert === "number") {
        }
        else if (!serialize && typeof valueToConvert === "string") {
            var result = 0;
            if (valueToConvert) {
                valueToConvert.split(",").forEach(function (valuePart) {
                    var enumName = _.trim(valuePart) || "";
                    if (enumName) {
                        var resultPart = enumType.enumValues[enumName];
                        if (!resultPart) {
                            var lowerCaseEnumName = enumName.toLowerCase();
                            if (lowerCaseEnumName !== enumName) {
                                Object.keys(enumType.enumValues).forEach(function (n) {
                                    var v = enumType.enumValues[n];
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
    function _getTranslatedDateValue(valueToConvert, serialize) {
        if (serialize && (valueToConvert instanceof Date) && Date.prototype.toISOString) {
            return valueToConvert.toISOString();
        }
        else if (!serialize && typeof valueToConvert === "string") {
            var dateValue = new Date(valueToConvert);
            return dateValue;
        }
        return valueToConvert;
    }
})(ContractSerializer = exports.ContractSerializer || (exports.ContractSerializer = {}));
