import { BuildOptions, OnLoadArgs, OnLoadOptions, OnLoadResult, OnResolveArgs, OnResolveResult, OnStartResult, Plugin, PluginBuild } from "esbuild"

export interface PluginCb<P, R> {
    filter: RegExp
    callback: (params: P,args?:any) => R
}


export interface ProxyBuilder {
    initialOptions: BuildOptions,
    resolveCb: PluginCb<OnResolveArgs, OnResolveResult | null | void | Promise<OnResolveResult | null | undefined>>[],
    startCb: (() => OnStartResult | void)[],
    endCb: (() => void)[],
    loadCb: PluginCb<OnLoadArgs, OnLoadResult | void | null | Promise<OnLoadResult | null | undefined>>[],
    transformCb: PluginCb<OnLoadResult, void>[],
    updateCb:((id:string,ctx:{event:'update'|'delete'})=>void)[],

    esbuild: PluginBuild["esbuild"]
    onResolve: PluginBuild["onResolve"]
    onLoad: PluginBuild["onLoad"]
    onTransForm: (options: OnLoadOptions, cb: (param: OnLoadResult,args:OnLoadOptions) => void) => void
    onUpdate:(cb:(id:string,ctx:{event:'update'|'delete'})=>void)=>void
    plugins: string[]
}

export type ProPlugin = {
    name: string;
    setup: (build: ProxyBuilder) => (void | Promise<void>);
    enforce?: 'pre' | 'post'
}