# Extension Packer
This utility packs and publishes extensions for Visual Studio Online, Visual Studio (planned) and Visual Studio Code (planned).

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

<ol>
    <li>Add `"publisher": "yourpublishername"` to the manifest. "yourpublishername" should be replaced by the **same name as the publisher you created in the Gallery**.</li>
    <li><p>Add assets that go into the VSIX package. For example:</p>
    <p><pre>"assets": [
        {
            "type": "Microsoft.VSO.LargeIcon",
            "path": "images/fabrikam-logo.png"
        }
    ],</pre></p>

    <p>**Note**: Paths should be relative to the manifest file.</p></li>
    <li>Additionally, you may want to add properties for `"tags"`, `"categories"`, and `"VSOFlags"`, each of which should be a list of strings.</li>
</ol>

## Run
If you are on Windows, simply invoke the packext.cmd helper to run the app. Otherwise, invoke node with public/src/scripts/app.js.

There are four commands:

* `package`. Generate a VSIX package from a set of partial manifests and assets.
* `publish`. Publish a VSIX package, which is either manually specified or generated.
* `create-publisher`. Create a publisher in the gallery.
* `delete-publisher`. Delete a publisher in the gallery.

To see a list of commands, run `packext --help`. To get help, including available options, for any command, run `packext <command> --help`.

### Package
This command packages a VSIX file with your extension manifest and your assets, ready to be published to the Gallery. You have two options for supplying inputs to this command: using a settings file, or using command-line flags. Otherwise, the following defaults will be used:

* `outputPath`: &lt;current working directory&gt;/extension.vsix
* `root`: &lt;current working directory&gt;
* `manifestGlobs`: **/*-manifest.json

#### Settings file
See the settings_example.json file for an example.

Your settings file is a JSON file with two root properties: `package` and `publish`. The package property contains a nested object with the following properties:
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
Invoke the app with the command `package`. If ./settings.json exists, that will be used. Otherwise use the `--settings` option to specify the path to your settings file. E.g.:

`packext package --settings path/to/settings.json`

#### Command-line arguments
Alternatively, you can use the following command-line arguments in lieu of the settings file:  
```txt
-r, --root <string>
-o, --output-path <string>
-m, --manifest-glob <string>
```
**Note**: When using command-line arguments, only one glob can be specified for finding manifests

### Publish
This command publishes a VSIX file to the Gallery. The VSIX can either be generated (default) or specified manually. The publish property in your settings file contains a nested object with the following properties:
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
    
    /**
     * Specify a path to the VSIX file that will get published. If this is omitted, 
     * the tool will auto-generate the package based on the package settings (see above).
     */
    "vsixPath": string;
}
```
To get a personal access token, navigate to `https://<your_account_url>/_details/security/tokens` and **Add** a new token for **All accessible accounts** and **All scopes**. Copy and paste the generated token into the settings.json file.

#### Command-line arguments
Alternatively, you can use the following command-line arguments in lieu of the settings file:  
```txt
-g, --gallery-url <string>
-t, --token <string>
-v, --vsix <string>
```

### Create and Delete Publisher
These commands are used to create or delete a publisher. When creating a publisher, you must specify the same galleryUrl and token that are required for publishing (either using a settings.json file or command line options).

`create-publisher` [options] &lt;unique_name&gt; &lt;display_name&gt; &lt;description&gt;

`delete-publisher` [options] &lt;unique_name&gt;

### Fiddler
If you want your requests to route through the Fiddler proxy, you must pass in the `--fiddler` option. Fiddler must be open if this is passed; otherwise all requests will fail.

### Examples

#### Package
`packext package` - use ./settings.json (or defaults) to package a VSIX

`packext package --root . --output-path C:\temp\myextension.vsix --manifest-glob **/*.json` - use command line options to package a VSIX

#### Publish
`packext publish` - use ./settings.json to publish a VSIX (which may be packaged also, depending on the presence of the publish.vsixPath property

`packext publish settings.json --root . --output-path C:\temp\myextension.vsix --manifest-glob **/*.json`

`packext publish settings.json --vsix C:\temp\existingextension.vsix`

#### Create publisher
`packext create-publisher settings.json "fabrikamCorp" "Fabrikam, inc." "This is Fabrikam, inc.'s main publisher."`

#### Delete publisher
`packext delete-publisher settings.json "fabrikamCorp"`
