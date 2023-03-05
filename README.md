## esbuild-plugin-merge

merge esbuild plugins and provide rollup features (`watchChange`,`transform`,`enforce` ) for plugin

```ts
import { merge, pre, ProPlugin } from "esbuild-plugin-merge";

let pluginA: ProPlugin = {
  name: "pluginA",
  enforce: "post",//like vite
  setup(build) {
    initOptions = build.initialOptions;

    //esbuild
    build.onResolve({ filter: /\.css/ }, (args) => {
      //...
    });
    build.onLoad({ filter: /\.css/ }, async (args) => {
      //...
    });

    // like rollup/vite
    build.onTransform({ filter: /\.css/ }, (loadres,args) => {
      //...
    });
    build.onUpdate((args) => {
      //...
    });
  },
};

const ret = await build({
  //...
  plugins: [merge([ build, pre(pluginB/**other esbuild plugin */)])],
});
```


 it depends on `watch` property in initOptions.
 not support esbuild^0.17.x
