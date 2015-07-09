# Visual Studio Online Extension Tool
This utility packs and publishes extensions for Visual Studio Online, as well as performs applicable upgrades to existing extensions.

# Usage
## Tooling
This app requires [NodeJS](http://nodejs.org) and npm (included with the NodeJS installer). 

## Setup
1. Run `npm install -g vset`.
2. If %APPDATA%\npm is in your PATH, simply invoke "vset"

### Prep your manifest(s)
This tool will merge any number of manifest files (all in JSON format) into the required .vsomanifest and .vxismanifest files. If you are using this tool with an extension for the first time, you may need to add a few things to your manifest:

<ol>
    <li>Add <code>"publisher": "yourpublishername"</code> to the manifest. "yourpublishername" should be replaced by the <strong>same name as the publisher you created in the Gallery</strong>.</li>
    <li>
        <p>Update the <code>icon</code> property to <code>icons</code>. Currently, we support a <code>default</code> and a <code>wide</code> icon. For example:</p>
        <p>
            <pre><code>"icons": {
    "default": "images/fabrikam-default.png",
    "wide": "images/fabrikam-wide.png"
}
            </code></pre>
        </p>
        <p>
            <strong>Note</strong>: Paths should be relative to the manifest file.
        </p>
    </li>
    <li>
        Additionally, you may want to add properties for <code>"tags"</code> and <code>"categories"</code>, each of which should be a list of strings. The following strings are valid categories: 
        <ul>
            <li>Build and release</li>
            <li>Collaboration</li>
            <li>Customer support</li>
            <li>Planning</li>
            <li>Productivity</li>
            <li>Sync and integration</li>
            <li>Testing</li>
        </ul>
    </li>
    <li>Extensions will be private by default. To specify a public extension, add <code>"public": true</code>.</li>
</ol>

## Run
If you are on Windows, simply invoke the vset.cmd helper to run the tool. Otherwise, invoke `node app.js`.

There are eight commands:

* `package`. Generate a VSIX package from a set of partial manifests and assets.
* `publish`. Publish a VSIX package, which is either manually specified or generated.
* `create-publisher`. Create a publisher in the gallery.
* `delete-publisher`. Delete a publisher in the gallery.
* `share`. Share a private extension with other accounts.
* `unshare`. Unshare a private extension.
* `show`. Show information about an extension.
* `migrate`. Upgrade a manifest to the M85 format.

To see a list of commands, run `vset --help`. To get help, including available options, for any command, run `vset <command> --help`.

### Package
This command packages a VSIX file with your extension manifest and your assets, ready to be published to the Gallery. First, we load all the manifests matched by the manifest-glob option, parse them as JSON, and attempt to merge them all into a single object. This allows you to maintain your manifest as several files, split into logical components. Then the VSIX package is generated and written to the file system.

You have two options for supplying inputs to this command: using command-line flags or using a settings file (see below). Otherwise, the following defaults will be used:

* `outputPath`: *current working directory*/*publisher*.*extension_namespace*-*version*.vsix
* `root`: *current working directory*
* `manifestGlob`: \*\*/\*-manifest.json

Invoke the app with the command `package`. If ./settings.vset.json exists, that will be used. Otherwise use the `--settings` option to specify the path to your settings file. E.g.:

`vset package --settings path/to/settings.vset.json`

#### Command-line arguments
You can use the following command-line arguments to override the defaults:
```txt
-r, --root <string>
-o, --output-path <string>
-m, --manifest-glob <string>
```
**Note**: When using command-line arguments, only one glob can be specified for finding manifests

#### Examples
`vset package --root . --output-path C:/temp/myextension.vsix --manifest-glob **/*.json` - use command line options to package a VSIX

`vset package` - use ./settings.vset.json (see below) or defaults (if settings.vset.json does not exist) to package a VSIX

### Publish
This command publishes a VSIX file to the Gallery. The VSIX can either be generated (default) or specified manually. You must specify two options for publishing:

```txt
-t, --token <string>       - Specify your personal access token.
-v, --vsix <string>        - If specified, publishes the VSIX at this path instead of auto-packaging.
-w, --share-with <string>  - If specified, share the extension with the comma-separated list of accounts (private extensions only).
```

To get a personal access token, navigate to `https://<your_account_url>/_details/security/tokens` and **Add** a new token for **All accessible accounts** and **All scopes**. Copy and paste the generated token into the settings.vset.json file.

If you do not specify the `--vsix` argument, the tool will first package the VSIX. In this case, you may additionally specify the arguments from the package section or rely on the defaults.

#### Temporary path for VSIX
If you don't want to keep the generated VSIX around after it is published, you can specify to use a temporary path in *package settings*. Simply use `{tmp}` as the outputPath. Note: The generated VSIX will be deleted after it is published.

#### Examples

`vset publish --root . --output-path C:/temp/myextension.vsix --manifest-glob **/*.json --token xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

`vset publish --vsix C:/temp/existingextension.vsix --token xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

`vset publish` - use ./settings.vset.json (see below) to publish a VSIX (which may be packaged also, depending on the presence of the publish.vsixPath property

### Create and Delete Publisher
These commands are used to create or delete a publisher. When creating a publisher, you must specify the same token that is required for publishing (either using a settings.vset.json file or command line options).

`create-publisher [options] <unique_name> <display_name> <description>`

`delete-publisher [options] <unique_name>`

#### Examples
`vset create-publisher "fabrikamCorp" "Fabrikam, inc." "This is Fabrikam, inc.'s main publisher." --token xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

`vset delete-publisher "fabrikamCorp"` - Use a settings.vset.json file (see below)

### Migrate
Use this command to migrate a manifest to the new model introduced in M85. For any items that may require your attention, you will see a warning.

Migrate requires two arguments, `path_to_manifest` and `publisher_name`. The 3rd argument, `output_path`, is optional.
`path_to_manifest` - Specify an absolute or relative path to the manifest you wish to migrate to M85.
`publisher_name` - Specify the name of the publisher you created in the VSO Gallery.
`output_path` - Specify an absolute or relative path to write the upgraded JSON. If omitted, overwrite the original file at `path_to_manifest`.

If there already exists a file at `output_path` (or if it is omitted), you must specify `-f` or `--force` to overwrite that file. 

#### Examples
`vset migrate extension.json MyPublisher extension-m85.json` - Migrate and write the result to extension-m85.json.
`vset migrate extension.json MyPublisher --force` - Migrate and overwrite the original file. 

### Sharing & Extension Info
You can use the commands `show`, `share`, and `unshare` to get information about a published extension, share a published extension (private), and un-share a published extension (private), respectively.

For each of these commands in addition to your personal access token, you must specify the extension, either by providing a path to the VSIX that was published, or by providing the publisher ID and extension ID.

```txt
-t, --token <string>     - Specify your personal access token.

-v, --vsix <string>      - Path to the VSIX that was published.
OR
-p, --publisher <string> - ID of the publisher of the extension
-e, --extension <string> - ExtensionId
```

#### Examples
`vset show --publisher fabrikam --extension my-extension --token xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` - Show information about the "my-extension" extension published by fabrikam.
`vset show --vsix C:/temp/path/to.vsix --token xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` - Show information about the indicated *published* VSIX.
`vset share --publisher fabrikam --extension my-private-extension --token xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx --share-with contoso,freezingfog` - Share the "my-private-extension" extension with the contoso and freezingfog accounts.
`vset unshare --publisher fabrikam --extension my-private-extension --token xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx --share-with contoso,freezingfog` - Un-share the "my-private-extension" extension with the contoso and freezingfog accounts.

You may also provide a `--settings` option (see below) to specify a personal access token.

### Advanced

#### Settings file
See the settings_example.json file for an example.

You may create a settings file (JSON format) to specify options instead of passing them as inputs each time. By default, the tool will look for ./settings.vset.json if no settings file is specified. Otherwise, you may specify the path using the `--settings <path_to_settings>` option.

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
        
        /**
         * Provides a way to silently override any values in the manifest. Useful, for example,
         * if you want to publish your changes under a different publisher without changing the 
         * extension manifest JSON.
         * 
         * The value of this property is treated just like any other partial manifest, except
         * that it is given highest priority.
         */
        "overrides": Object;
    }
    
    /**
     * Settings for publishing and publisher management
     */
    "publish" {        
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
        
        /**
         * Array of account names to share this extension with
         */
        "shareWith": string[];
    }
}
```

#### Fiddler
If you want your requests to route through the Fiddler proxy, you must pass in the `--fiddler` option. Fiddler must be open if this is passed; otherwise all requests will fail.

#### Debug
Pass the `--debug` flag to get additional log messages in the console window.

#### Suppress title
Pass the `--nologo` flag to suppress printing the title message when running the tool. Useful if you want to parse the output of the tool.