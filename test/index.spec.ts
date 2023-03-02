import { build, Plugin } from 'esbuild'
import { merge, pre } from '../src'
import { test, expect, vi } from 'vitest'
import path from 'path'
import fs from 'fs'
import { ProPlugin } from '../src/types'

test('merge plugins order', async () => {

    const fn = vi.fn((id: string) => id)
    let initOptions: any
    let pluginA: ProPlugin = {
        name: 'pluginA',
        setup(build) {
            build.onStart(()=>{fn('startA')})
            
            build.onEnd(()=>{fn('endA')})

            initOptions = build.initialOptions
            build.onResolve({ filter: /\.css/, }, (args) => {
                fn('resolve-pluginA')
                return { path: path.join(args.resolveDir, args.path) }
            })
            build.onLoad({ filter: /\.css/, }, async (args) => {
                fn('load-pluginA')
                let text = await fs.promises.readFile(args.path, 'utf8')

                return {
                    contents: text,
                    loader: 'css'
                }
            })
            build.onTransForm({ filter: /\.css/ }, (args) => {
                fn('transform-pluginA')
                args.contents = 'console.log("pluginA")'

            })
            // build.onTransform()
        },
    }

    let pluginB: ProPlugin = {
        name: 'pluginB',
        setup(build) {
build.onStart(()=>{fn('startB')})
build.onEnd(()=>{fn('endB')})

            build.onResolve({ filter: /\.css/, }, (args) => {
                fn('resolve-pluginB')
                return { path: path.join(args.resolveDir, args.path) }
            })
            build.onLoad({ filter: /\.css/ }, async (args) => {
                fn('load-pluginB')

                return {
                    contents: 'console.log("pluginB")',
                    loader: 'js',
                }
            })

            build.onTransForm({ filter: /\.css/ }, () => {
                fn('transform-pluginB')

            })
        },
    }

    const ret = await build({
        format: 'esm',
        entryPoints: ['test/fixtures/main.ts'],
        write: false,
        plugins: [
            merge([pluginA, pre(pluginB)])
        ],
        bundle: true,
    })

    expect(initOptions).toMatchSnapshot()

    expect(fn).toHaveBeenCalledTimes(8)
    expect(fn).toHaveNthReturnedWith(3, 'resolve-pluginB')
    expect(fn).toHaveNthReturnedWith(4, 'load-pluginB')
    expect(fn).toHaveNthReturnedWith(5, 'transform-pluginB')
    expect(fn).toHaveNthReturnedWith(6, 'transform-pluginA')

    expect(ret.outputFiles[0].text).toMatchSnapshot()
})