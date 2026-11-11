package coffee.accdb;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Lector JSON mínimo (sin reflexión, para que la compilación nativa sea simple). */
final class Json {
  private final String s;
  private int i;

  private Json(String s) {
    this.s = s;
  }

  static Object parse(String text) {
    Json p = new Json(text);
    p.ws();
    Object v = p.value();
    p.ws();
    if (p.i != p.s.length()) throw p.error("contenido sobrante");
    return v;
  }

  private IllegalArgumentException error(String what) {
    return new IllegalArgumentException("JSON no válido (" + what + ") en la posición " + i);
  }

  private void ws() {
    while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++;
  }

  private Object value() {
    if (i >= s.length()) throw error("fin inesperado");
    char c = s.charAt(i);
    switch (c) {
      case '{': return object();
      case '[': return array();
      case '"': return string();
      case 't': expect("true"); return Boolean.TRUE;
      case 'f': expect("false"); return Boolean.FALSE;
      case 'n': expect("null"); return null;
      default: return number();
    }
  }

  private void expect(String word) {
    if (!s.startsWith(word, i)) throw error("se esperaba " + word);
    i += word.length();
  }

  private Map<String, Object> object() {
    Map<String, Object> map = new LinkedHashMap<>();
    i++;
    ws();
    if (s.charAt(i) == '}') { i++; return map; }
    while (true) {
      ws();
      String key = string();
      ws();
      if (s.charAt(i++) != ':') throw error("se esperaba :");
      ws();
      map.put(key, value());
      ws();
      char c = s.charAt(i++);
      if (c == '}') return map;
      if (c != ',') throw error("se esperaba , o }");
    }
  }

  private List<Object> array() {
    List<Object> list = new ArrayList<>();
    i++;
    ws();
    if (s.charAt(i) == ']') { i++; return list; }
    while (true) {
      ws();
      list.add(value());
      ws();
      char c = s.charAt(i++);
      if (c == ']') return list;
      if (c != ',') throw error("se esperaba , o ]");
    }
  }

  private String string() {
    if (s.charAt(i) != '"') throw error("se esperaba una cadena");
    i++;
    StringBuilder b = new StringBuilder();
    while (true) {
      char c = s.charAt(i++);
      if (c == '"') return b.toString();
      if (c != '\\') { b.append(c); continue; }
      char e = s.charAt(i++);
      switch (e) {
        case 'n': b.append('\n'); break;
        case 't': b.append('\t'); break;
        case 'r': b.append('\r'); break;
        case 'b': b.append('\b'); break;
        case 'f': b.append('\f'); break;
        case 'u': b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; break;
        default: b.append(e);
      }
    }
  }

  private Object number() {
    int start = i;
    while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
    String n = s.substring(start, i);
    if (n.isEmpty()) throw error("valor desconocido");
    if (n.contains(".") || n.contains("e") || n.contains("E")) return Double.parseDouble(n);
    long l = Long.parseLong(n);
    return l;
  }
}
