## esbuild-plugin-merge

merge esbuild plugins and provide rollup features (`watchChange`,`transform`,`enhance` ) for plugin

```ts
import { merge, pre ,ProPlugin} from "esbuild-plugin-merge";

let pluginA: ProPlugin = {
  name: "pluginA",
  setup(build) {
    initOptions = build.initialOptions;
    build.onResolve({ filter: /\.css/ }, (args) => {
      //...
    });
    build.onLoad({ filter: /\.css/ }, async (args) => {
      //...
    });
    build.onTransForm({ filter: /\.css/ }, (args) => {
      //...
    });
    build.onUpdate(()=>{
        //...
    })
  },
};

const ret = await build({
  //...
  plugins: [merge([pluginB /**other plugins */, pre(pluginA)])],
});
```
