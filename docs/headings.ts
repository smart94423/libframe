import React from 'react'
import { getFrame } from './frame'
import { assert } from './utils'
import { Emoji, EmojiName } from './utils/Emoji'

export { getHeadings }
export { parseTitle }

export type Heading = Omit<HeadingDefinition, 'title' | 'titleInNav'> & {
  title: JSX.Element
  titleInNav: JSX.Element
  parentHeading?: Heading
  // Not sure why this is needed
  isListTitle?: true
}
export type HeadingDefinition = HeadingBase &
  (
    | ({ level: 1; titleEmoji: EmojiName } & HeadingAbstract)
    | ({ level: 4 } & HeadingAbstract)
    | {
        level: 2
        isListTitle?: true
        url: string
      }
    | {
        level: 3
        url: string
      }
  )
type HeadingBase = {
  title: string
  level: number
  url?: string
  titleDocument?: string
  titleInNav?: string
  // titleSize?: string
  isActive?: true
}
type HeadingAbstract = {
  url?: undefined
  titleDocument?: undefined
  titleInNav?: undefined
  isActive?: undefined
}

function getHeadings(): Heading[] {
  const _headings = getFrame().headings
  assert(_headings !== undefined)
  const headings: Heading[] = _headings.map((heading: HeadingDefinition) => {
    const titleProcessed: JSX.Element = parseTitle(heading.title)

    const titleInNav = heading.titleInNav || heading.title
    let titleInNavProcessed: JSX.Element
    if ('isListTitle' in heading) {
      assert(heading.isListTitle === true)
      let titleParsed: JSX.Element = parseTitle(titleInNav)
      // if (heading.titleSize) {
      //   titleParsed = React.createElement('span', { style: { fontSize: heading.titleSize } }, titleParsed)
      // }
      titleInNavProcessed = React.createElement(React.Fragment, {}, [getListPrefix(), titleParsed])
    } else {
      titleInNavProcessed = parseTitle(titleInNav)
    }
    if ('titleEmoji' in heading) {
      assert(heading.titleEmoji)
      titleInNavProcessed = withEmoji(heading.titleEmoji, titleInNavProcessed)
    }

    const headingProcessed: Heading = {
      ...heading,
      title: titleProcessed,
      titleInNav: titleInNavProcessed,
    }
    return headingProcessed
  })
  assert_headings(headings)
  return headings
}

function assert_headings(headings: Heading[]) {
  const urls: Record<string, true> = {}
  headings.forEach((heading) => {
    if (heading.url) {
      const { url } = heading
      assert(!urls[url], { url })
      urls[url] = true
    }
  })
}

function getListPrefix() {
  const nonBreakingSpace = String.fromCodePoint(0x00a0)
  const bulletPoint = String.fromCodePoint(0x2022)
  return nonBreakingSpace + bulletPoint + nonBreakingSpace
}

function parseTitle(title: string): JSX.Element {
  type Part = { nodeType: 'text' | 'code'; content: string }
  const parts: Part[] = []
  let current: Part | undefined
  title.split('').forEach((letter) => {
    if (letter === '`') {
      if (current?.nodeType === 'code') {
        // </code>
        parts.push(current)
        current = undefined
      } else {
        // <code>
        if (current) {
          parts.push(current)
        }
        current = { nodeType: 'code', content: '' }
      }
    } else {
      if (!current) {
        current = { nodeType: 'text', content: '' }
      }
      current.content += letter
    }
  })
  if (current) {
    parts.push(current)
  }

  const titleJsx = React.createElement(
    React.Fragment,
    {},
    ...parts.map((part) => {
      if (part.nodeType === 'code') {
        return React.createElement('code', {}, part.content)
      } else {
        assert(part.nodeType === 'text')
        return part.content
      }
    }),
  )

  return titleJsx
}

function withEmoji(name: EmojiName, title: string | JSX.Element): JSX.Element {
  const style = { fontSize: '1.4em' }
  //return React.createElement(React.Fragment, null, Emoji({ name, style }), ' ', title)
  return React.createElement(
    'span',
    { style },
    Emoji({ name }),
    ' ',
    React.createElement('span', { style: { fontSize: '1rem' } }, title),
  )
}
