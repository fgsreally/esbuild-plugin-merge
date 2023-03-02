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

const watchListRecord: Record<string, chokidar.FSWatcher> = {}
const watchList: Set<string> = new Set()


export const proxyBuilder: ProxyBuilder = {
    onResolve: (options, cb) => {
        proxyBuilder.resolveCb.push({
            filter: options.filter,
            callback: cb
        })
    },
    onLoad: (options, cb) => {
        proxyBuilder.loadCb.push({
            filter: options.filter,
            callback: cb
        })
    },
    onTransForm: (options, cb) => {
        proxyBuilder.transformCb.push({
            filter: options.filter,
            callback: cb
        })
    },
    onUpdate: (cb) => {
        proxyBuilder.updateCb.push(cb)
    },
    onStart:(cb)=>{ proxyBuilder.startCb.push(cb)},
    onEnd:(cb)=>{ proxyBuilder.endCb.push(cb)},

    esbuild: null as any,
    initialOptions: null as any,
    resolveCb: [],
    startCb: [],
    endCb: [],
    loadCb: [],
    transformCb: [],
    updateCb:[],
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


            for (let cb of proxyBuilder.startCb) {
                build.onStart(async () => {
                    return cb()
                })
            }
            for (let cb of proxyBuilder.endCb) {
                build.onEnd(async (param) => {
                    return cb(param)
                })
            }

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

            const rebuild = () => builder({
                ...build.initialOptions,
                watch: false,
            })


            build.onEnd(() => {

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
                                for (let cb of proxyBuilder.updateCb) {
                                    await cb(id, { event: 'update' })

                                } rebuild()
                            })
                            watchListRecord[id].on('unlink', async () => {
                                for (let cb of proxyBuilder.updateCb) {
                                    await cb(id, { event: 'delete' })

                                }
                                rebuild()
                            })
                        }
                    })
                }


            })
        }

    }


}

export * from './types'
