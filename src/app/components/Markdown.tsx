import { Linking, StyleSheet, Text, View, type TextStyle } from "react-native";
import { useTheme, type Theme } from "../theme";

type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold" | "italic"; children: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; url: string };

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "item"; marker: string; text: string }
  | { kind: "code"; text: string }
  | { kind: "paragraph"; text: string };

const inlinePattern =
  /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s)]+)/;

function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  while (rest) {
    const m = inlinePattern.exec(rest);
    if (!m) {
      out.push({ kind: "text", text: rest });
      break;
    }
    if (m.index > 0) out.push({ kind: "text", text: rest.slice(0, m.index) });
    if (m[2] !== undefined) out.push({ kind: "bold", children: parseInline(m[2]) });
    else if (m[4] !== undefined) out.push({ kind: "italic", children: parseInline(m[4]) });
    else if (m[5] !== undefined) out.push({ kind: "code", text: m[5] });
    else if (m[6] !== undefined) out.push({ kind: "link", text: m[6], url: m[7] });
    else out.push({ kind: "link", text: m[8], url: m[8] });
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.split("\n");
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      flush();
      const code: string[] = [];
      while (++i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i]);
      blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const item = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
    } else if (item) {
      flush();
      const marker = /\d/.test(item[1]) ? item[1] : "•";
      blocks.push({ kind: "item", marker, text: item[2] });
    } else if (!line.trim()) {
      flush();
    } else {
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}

function renderInline(parts: Inline[], theme: Theme, key = ""): React.ReactNode[] {
  return parts.map((part, i) => {
    const k = `${key}${i}`;
    switch (part.kind) {
      case "text":
        return part.text;
      case "bold":
        return (
          <Text key={k} style={styles.bold}>
            {renderInline(part.children, theme, `${k}-`)}
          </Text>
        );
      case "italic":
        return (
          <Text key={k} style={styles.italic}>
            {renderInline(part.children, theme, `${k}-`)}
          </Text>
        );
      case "code":
        return (
          <Text key={k} style={[styles.code, { backgroundColor: theme.border }]}>
            {part.text}
          </Text>
        );
      case "link":
        return (
          <Text
            key={k}
            style={[styles.link, { color: theme.accent }]}
            onPress={() => Linking.openURL(part.url).catch(() => undefined)}
            accessibilityRole="link"
          >
            {part.text}
          </Text>
        );
    }
  });
}

const headingSizes = [22, 19, 17, 16, 15, 15];

/** Shows Markdown notes formatted: headings, bold, italics, lists, links and code. */
export function Markdown({ source, style }: { source: string; style?: TextStyle }) {
  const theme = useTheme();
  const base = [styles.text, { color: theme.text }, style];
  return (
    <View style={styles.wrap}>
      {parseBlocks(source).map((block, i) => {
        switch (block.kind) {
          case "heading":
            return (
              <Text
                key={i}
                style={[base, styles.heading, { fontSize: headingSizes[block.level - 1] }]}
              >
                {renderInline(parseInline(block.text), theme)}
              </Text>
            );
          case "item":
            return (
              <View key={i} style={styles.item}>
                <Text style={[base, styles.marker]}>{block.marker}</Text>
                <Text style={[base, styles.itemText]}>
                  {renderInline(parseInline(block.text), theme)}
                </Text>
              </View>
            );
          case "code":
            return (
              <Text
                key={i}
                style={[base, styles.code, styles.codeBlock, { backgroundColor: theme.border }]}
              >
                {block.text}
              </Text>
            );
          case "paragraph":
            return (
              <Text key={i} style={base}>
                {renderInline(parseInline(block.text), theme)}
              </Text>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  text: { fontSize: 15, lineHeight: 21 },
  heading: { fontWeight: "700", marginTop: 4 },
  bold: { fontWeight: "700" },
  italic: { fontStyle: "italic" },
  code: { fontFamily: "monospace", fontSize: 13 },
  codeBlock: { padding: 8, borderRadius: 6 },
  link: { textDecorationLine: "underline" },
  item: { flexDirection: "row", gap: 8, paddingLeft: 4 },
  marker: { minWidth: 14 },
  itemText: { flex: 1 },
});
