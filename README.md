# Visual Studio Online Extension Tool
This utility packs and publishes extensions for Visual Studio Online.

# Usage
## Tooling
This app requires [NodeJS](http://nodejs.org) and npm (included with the NodeJS installer). 

## Setup
1. Run `npm install -g vset`.
2. The tool can be run using `vset.cmd` or by invoking `node app.js`.

### Prep your manifest(s)
This tool will merge any number of manifest files (all in JSON format) into the required .vsomanifest and .vxismanifest files. If you are using this tool with an extension for the first time, you may need to add a few things to your manifest:

<ol>
    <li>Add <code>"publisher": "yourpublishername"</code> to the manifest. "yourpublishername" should be replaced by the <strong>same name as the publisher you created in the Gallery</strong>.</li>
    <li><p>Add assets that go into the VSIX package. For example:</p>
    <p><pre><code>"assets": [
        {
            "type": "Microsoft.VSO.LargeIcon",
            "path": "images/fabrikam-logo.png"
        }
    ],</code></pre></p>

    <p><strong>Note</strong>: Paths should be relative to the manifest file.</p></li>
    <li>Additionally, you may want to add properties for <code>"tags"</code>, <code>"categories"</code>, and <code>"VSOFlags"</code>, each of which should be a list of strings.</li>
    <li>Extensions will be private by default. To specify a public extension, add <code>"public": true</code>.</li>
</ol>

## Run
If you are on Windows, simply invoke the vset.cmd helper to run the tool. Otherwise, invoke `node app.js`.

There are five commands:

* `package`. Generate a VSIX package from a set of partial manifests and assets.
* `publish`. Publish a VSIX package, which is either manually specified or generated.
* `create-publisher`. Create a publisher in the gallery.
* `delete-publisher`. Delete a publisher in the gallery.
* `toM85`. Upgrade a manifest to the M85 format.

To see a list of commands, run `vset --help`. To get help, including available options, for any command, run `vset <command> --help`.

### Package
This command packages a VSIX file with your extension manifest and your assets, ready to be published to the Gallery. You have two options for supplying inputs to this command: using command-line flags or using a settings file (see below). Otherwise, the following defaults will be used:

* `outputPath`: *current working directory*/*publisher*.*extension_namespace*-*version*.vsix
* `root`: *current working directory*
* `manifestGlob`: \*\*/\*-manifest.json

Invoke the app with the command `package`. If ./settings.json exists, that will be used. Otherwise use the `--settings` option to specify the path to your settings file. E.g.:

`vset package --settings path/to/settings.json`

#### Command-line arguments
You can use the following command-line arguments to override the defaults:
```txt
-r, --root <string>
-o, --output-path <string>
-m, --manifest-glob <string>
```
**Note**: When using command-line arguments, only one glob can be specified for finding manifests

#### Examples
`vset package --root . --output-path C:\temp\myextension.vsix --manifest-glob **/*.json` - use command line options to package a VSIX

`vset package` - use ./settings.json (see below) or defaults (if settings.json does not exist) to package a VSIX

### Publish
This command publishes a VSIX file to the Gallery. The VSIX can either be generated (default) or specified manually. You must specify two options for publishing:

```txt
-t, --token <string>       - Specify your personal access token.
-g, --gallery-url <string> - Specify the URL to the Visual Studio Online Gallery.
-v, --vsix <string>        - If specified, publishes the VSIX at this path instead of auto-packaging
```

To get a personal access token, navigate to `https://<your_account_url>/_details/security/tokens` and **Add** a new token for **All accessible accounts** and **All scopes**. Copy and paste the generated token into the settings.json file.

If you do not specify the `--vsix` argument, the tool will first package the VSIX. In this case, you may additionally specify the arguments from the package section or rely on the defaults.

#### Temporary path for VSIX
If you don't want to keep the generated VSIX around after it is published, you can specify to use a temporary path in *package settings*. Simply use `{tmp}` as the outputPath. Note: The generated VSIX will be deleted after it is published.

#### Examples

`vset publish --root . --output-path C:\temp\myextension.vsix --manifest-glob **/*.json --gallery-url https://gallery.visualstudio.com --token xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

`vset publish --vsix C:\temp\existingextension.vsix --gallery-url https://gallery.visualstudio.com --token xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

`vset publish` - use ./settings.json (see below) to publish a VSIX (which may be packaged also, depending on the presence of the publish.vsixPath property

### Create and Delete Publisher
These commands are used to create or delete a publisher. When creating a publisher, you must specify the same galleryUrl and token that are required for publishing (either using a settings.json file or command line options).

`create-publisher [options] &lt;unique_name&gt; &lt;display_name&gt; &lt;description&gt;`

`delete-publisher [options] &lt;unique_name&gt;`

#### Examples
`vset create-publisher "fabrikamCorp" "Fabrikam, inc." "This is Fabrikam, inc.'s main publisher." --gallery-url https://gallery.visualstudio.com --token xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx``

`vset delete-publisher "fabrikamCorp"` - Use a settings.json file (see below)

### Advanced

#### Settings file
See the settings_example.json file for an example.

You may create a settings file (JSON format) to specify options instead of passing them as inputs each time. By default, the tool will look for ./settings.json if no settings file is specified. Otherwise, you may specify the path using the `--settings <path_to_settings>` option.

Your settings file is a JSON file with two root properties: `package` and `publish`. Each of those points to a nested object with their respective settings, modeled by the following schema:
```typescript
{
    /**
     * Settings for VSIX packaging
     */
    "package" {
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
    
    /**
     * Settings for publishing and publisher management
     */
    "publish" {
        /**
         * URL to the Visual Studio Online Gallery
         */
        "galleryUrl": string;
        
        /**
         * Personal Access Token (52-character alphanumeric string)
         * for publishing extensions (all accounts, all scopes)
         */
		"token": string;
        
        /**
         * Path to a VSIX to be published. If not specified, the
         * VSIX will be generated using package settings above
         */
		"vsixPath": string;
    }
}
```

#### Fiddler
If you want your requests to route through the Fiddler proxy, you must pass in the `--fiddler` option. Fiddler must be open if this is passed; otherwise all requests will fail.
