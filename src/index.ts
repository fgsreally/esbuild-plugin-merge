import { OnLoadResult, Plugin, PluginBuild } from 'esbuild'
import { ProPlugin, ProxyBuilder } from './types'
import chokidar from 'chokidar'
import fs from 'fs'
import { resolve } from 'path'

type ResolvedPlugin = Plugin & { enforce?: 'pre' | 'post' } | ProPlugin
export function pre(plugin: ResolvedPlugin) {
    plugin.enforce = 'pre'
    return plugin as Plugin
}
export function post(plugin: ResolvedPlugin) {
    plugin.enforce = 'post'
    return plugin as Plugin

}

let isBuilding = false
let isFirstTime = true
const watchListRecord: Record<string, chokidar.FSWatcher> = {}
const watchList: Set<string> = new Set()


export const proxyBuilder: ProxyBuilder = {
    onResolve: (options, cb) => {
        if (isFirstTime)
            proxyBuilder.resolveCb.push({
                filter: options.filter,
                callback: cb
            })
    },
    onLoad: (options, cb) => {
        if (isFirstTime)
            proxyBuilder.loadCb.push({
                filter: options.filter,
                callback: cb
            })
    },
    onTransform: (options, cb) => {
        if (isFirstTime)
            proxyBuilder.transformCb.push({
                filter: options.filter,
                callback: cb
            })
    },
    onUpdate: (cb) => {
        if (isFirstTime)
            proxyBuilder.updateCb.push(cb)
    },
    onStart: (cb) => {
        if (isFirstTime)
            proxyBuilder.startCb.push(cb)
    },
    onEnd: (cb) => {
        if (isFirstTime)
            proxyBuilder.endCb.push(cb)
    },

    esbuild: null as any,
    initialOptions: null as any,
    resolveCb: [],
    startCb: [],
    endCb: [],
    loadCb: [],
    transformCb: [],
    updateCb: [],
    plugins: []
}


function sortPlugins(plugins: ResolvedPlugin[],) {

    let preRet: any = [], ret: any = [], postRet: any = []
    for (let plugin of plugins) {
        if (plugin.enforce) {
            plugin.enforce === 'pre' ? preRet.push(plugin) : postRet.push(plugin)
        } else {
            ret.push(plugin)
        }
    }

    return [...preRet, ...ret, ...postRet]
}

export function setBuildingState(state: boolean) {
    isBuilding = state
}

export function merge(plugins: ResolvedPlugin[]): Plugin {
    return {
        name: 'esbuild-plugin-merge',
        async setup(build) {

            const { esbuild: { build: builder } } = build
            proxyBuilder.initialOptions = build.initialOptions
            proxyBuilder.esbuild = build.esbuild
            plugins = sortPlugins(plugins)



            for (let plugin of plugins) {

                await plugin.setup(proxyBuilder as any)
            }

            if (isFirstTime) {
                for (let cb of proxyBuilder.startCb) {
                    build.onStart(async () => {
                        return cb()
                    })
                }
            }


           isFirstTime&& build.onEnd(async (param) => {
                for (let cb of proxyBuilder.endCb) {
                    await cb(param)
                }

            })


            build.onResolve({ filter: /.*/ }, async (args) => {
                for (let item of proxyBuilder.resolveCb) {
                    if (item.filter.test(args.path)) {
                        let ret = await item.callback(args)
                        if (ret) return ret
                    }
                }
            })

            build.onLoad({ filter: /.*/ }, async (args) => {
                let loadRes: any
                if (fs.existsSync(args.path)) {
                    watchList.add(resolve(args.path))

                }
                for (let item of proxyBuilder.loadCb) {
                    if (item.filter.test(args.path)) {
                        loadRes = await item.callback(args)
                        if (loadRes) break
                    }
                }

                for (let item of proxyBuilder.transformCb) {
                    if (item.filter.test(args.path)) {
                        await item.callback(loadRes, args)
                    }
                }
                return loadRes as OnLoadResult
            })

            const rebuild = async () => {
                isBuilding = true
                await builder({
                    ...build.initialOptions,
                    watch: false,
                })
                isBuilding = false

            }


            isFirstTime&& build.onEnd(() => {

                if (build.initialOptions.watch) {

                    Object.keys(watchListRecord).forEach((id) => {
                        if (!watchList.has(id)) {
                            watchListRecord[id].close()
                            delete watchListRecord[id]
                        }
                    })
                    watchList.forEach((id) => {
                        if (!Object.keys(watchListRecord).includes(id)) {
                            watchListRecord[id] = chokidar.watch(id)
                            watchListRecord[id].on('change', async () => {
                                if (!isBuilding) {
                                    for (let cb of proxyBuilder.updateCb) {
                                        await cb(id, { event: 'update' })

                                    }
                                    await rebuild()
                                }
                            })
                            watchListRecord[id].on('unlink', async () => {
                                if (!isBuilding) {
                                    watchList.delete(id)
                                    for (let cb of proxyBuilder.updateCb) {
                                        await cb(id, { event: 'delete' })

                                    }
                                    await rebuild()
                                }
                            })
                        }
                    })
                }


            })
            isFirstTime = false
        }

    }


}

export * from './types'
