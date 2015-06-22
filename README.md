# Extension Packer
This utility packs and publishes extensions for Visual Studio, Visual Studio Online, and Visual Studio Code.

# Usage
## Tooling
This app requires [NodeJS](http://nodejs.org), NPM (included with the NodeJS installer), and the TypeScript Compiler v1.5.0-beta (which can be obtained using `npm i -g typescript`).

## Setup
1. Clone the repository
2. `cd` into the directory
3. Run `npm install`
4. Run `tsc -p .`

### Prep your manifest(s)
This tool will merge any number of manifest files (all in JSON format) into the required .vsomanifest and .vxismanifest files. If you are using this tool with an extension for the first time, you may need to add a few things to your manifest:

1. Add `"publisher": "yourpublishername"` to the manifest. "yourpublishername" should be replaced by the **same name as the publisher you created in the Gallery**.
2. Add assets that go into the VSIX package. For example: 
```json
    "assets": [
        {
            "type": "Microsoft.VSO.LargeIcon",
            "path": "images/fabrikam-logo.png"
        }
    ],
```
**Note**: Paths should be relative to the manifest file.   
3. Additionally, you may want to add properties for `"tags"`, `"categories"`, and `"VSOFlags"`, each of which should be a list of strings.

## Run
There are two commands, **package** and **publish**.

### Package
This command packages a VSIX file with your extension manifest and your assets, ready to be published to the Gallery. You have two options for supplying inputs to this command: using a settings file, or using command-line flags.

#### Settings file
Create package_settings.json and include the following key-value pairs:
```typescript
{
    /**
     * Specify the root folder from which the manifest globs should search for manifests.
     */
    "root": string;
    
    /**
     * Specify the output path and filename for the generated VSIX file.
     */
    "outputPath": string;
    
    /**
     * Specify a list of globs for searching for partial manifests.
     */
    "manifestGlobs": string|string[];
}
```
Invoke the app with the command `package`, passing the settings file as the only other argument. E.g.:

`node public\src\scripts\app.js package package_settings.json`

#### Command-line arguments
Alternatively, you can use the following command-line arguments in lieu of the settings file:  
```txt
--root <string>
--output-path <string>
--manifest-glob <string>
```
**Note**: When using command-line arguments, only one glob can be specified for finding manifests

### Publish
This command publishes a VSIX file to the Gallery. The VSIX can either be generated (default) or specified manually. TO use the publish command, you must first create a publish_settings.json file containing the following key-value pairs:
```typescript
{
    /**
     * Specify the URL to the Gallery.
     */
    "galleryUrl": string;
    
    /**
     * Specify the personal access token that will be used to authenticate the publish request.
     */
    "token": string;
}
```
To get a personal access token, navigate to `https://<your_account_url>/_details/security/tokens` and **Add** a new token for **All accessible accounts** and **All scopes**. Copy and paste the generated token into the publish_settings.json file.

The first argument to the publish command is the path to the publish settings file. If you want the VSIX to be generated via the `package` command above, the next argument should be the path to the package settings file (or specify the necessary values with command line flags). If you want an existing VSIX file to be published, you may specify that file using the `--vsix` command line flag.

### Examples

#### Package
`node public\src\scripts\app.js package package_settings.json`

`node public\src\scripts\app.js package --root . --output-path C:\temp\myextension.vsix --manifest-glob **/*.json`

#### Publish
`node public/src/scripts/app.js publish publish_settings.json package_settings.json`

`node public/src/scripts/app.js publish publish_settings.json --root . --output-path C:\temp\myextension.vsix --manifest-glob **/*.json`

`node public/src/scripts/app.js publish publish_settings.json --vsix C:\temp\existingextension.vsix`