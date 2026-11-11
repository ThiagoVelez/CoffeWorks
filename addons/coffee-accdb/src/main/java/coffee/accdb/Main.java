package coffee.accdb;

import com.healthmarketscience.jackcess.ColumnBuilder;
import com.healthmarketscience.jackcess.DataType;
import com.healthmarketscience.jackcess.Database;
import com.healthmarketscience.jackcess.DatabaseBuilder;
import com.healthmarketscience.jackcess.IndexBuilder;
import com.healthmarketscience.jackcess.RelationshipBuilder;
import com.healthmarketscience.jackcess.Table;
import com.healthmarketscience.jackcess.TableBuilder;

import java.io.File;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Complemento de compatibilidad con Access de CoffeeWorks.
 *
 * <pre>
 *   coffee-accdb version
 *   coffee-accdb export entrada.json salida.accdb
 * </pre>
 *
 * La entrada describe tablas, columnas, filas y relaciones (la genera
 * CoffeeDataBase). Escribe una base de Access 2010 (.accdb) o, si la salida
 * termina en .mdb, una de Access 2000.
 */
public final class Main {
  static final String VERSION = "1.0.0";

  public static void main(String[] args) {
    try {
      if (args.length >= 1 && args[0].equals("version")) {
        System.out.println("coffee-accdb " + VERSION);
        return;
      }
      if (args.length == 3 && args[0].equals("export")) {
        String json = new String(Files.readAllBytes(new File(args[1]).toPath()), StandardCharsets.UTF_8);
        int tables = export(json, new File(args[2]));
        System.out.println("OK " + tables);
        return;
      }
      System.err.println("Uso: coffee-accdb version | coffee-accdb export entrada.json salida.accdb");
      System.exit(2);
    } catch (Exception e) {
      String message = e.getMessage() == null ? e.toString() : e.getMessage();
      System.err.println(message);
      System.exit(1);
    }
  }

  @SuppressWarnings("unchecked")
  static int export(String json, File out) throws Exception {
    Map<String, Object> doc = (Map<String, Object>) Json.parse(json);
    List<Map<String, Object>> tables = (List<Map<String, Object>>) doc.get("tables");
    List<Map<String, Object>> relationships = (List<Map<String, Object>>) doc.getOrDefault("relationships", new ArrayList<>());
    if (out.exists() && !out.delete()) throw new IllegalStateException("No se puede reemplazar " + out);
    Database.FileFormat format = out.getName().toLowerCase().endsWith(".mdb") ? Database.FileFormat.V2000 : Database.FileFormat.V2010;

    try (Database db = new DatabaseBuilder(out).setFileFormat(format).create()) {
      for (Map<String, Object> t : tables) {
        String name = (String) t.get("name");
        List<Map<String, Object>> columns = (List<Map<String, Object>>) t.get("columns");
        TableBuilder tb = new TableBuilder(name);
        List<String> pk = new ArrayList<>();
        for (Map<String, Object> c : columns) {
          String type = (String) c.get("type");
          ColumnBuilder cb = new ColumnBuilder((String) c.get("name")).setType(dataType(type));
          if (type.equals("shortText")) cb.setLengthInUnits(255);
          if (type.equals("autonumber")) cb.setAutoNumber(true);
          tb.addColumn(cb);
          if (Boolean.TRUE.equals(c.get("pk"))) pk.add((String) c.get("name"));
        }
        if (!pk.isEmpty()) tb.addIndex(new IndexBuilder(IndexBuilder.PRIMARY_KEY_NAME).addColumns(pk.toArray(new String[0])).setPrimaryKey());
        Table table = tb.toTable(db);

        List<List<Object>> rows = (List<List<Object>>) t.getOrDefault("rows", new ArrayList<>());
        List<Object[]> batch = new ArrayList<>();
        for (List<Object> row : rows) {
          Object[] values = new Object[columns.size()];
          for (int k = 0; k < columns.size(); k++) {
            String type = (String) columns.get(k).get("type");
            values[k] = k < row.size() ? convert(row.get(k), type) : null;
          }
          batch.add(values);
        }
        if (!batch.isEmpty()) table.addRows(batch);
      }

      for (Map<String, Object> r : relationships) {
        try {
          RelationshipBuilder rb = new RelationshipBuilder((String) r.get("parent"), (String) r.get("child"))
              .addColumns((String) r.get("parentColumn"), (String) r.get("childColumn"))
              .setReferentialIntegrity();
          if (Boolean.TRUE.equals(r.get("cascadeDelete"))) rb.setCascadeDeletes();
          if (Boolean.TRUE.equals(r.get("cascadeNull"))) rb.setCascadeNullOnDelete();
          rb.toRelationship(db);
        } catch (Exception e) {
          // Si los datos no cumplen la integridad, se crea la relación sin exigirla.
          new RelationshipBuilder((String) r.get("parent"), (String) r.get("child"))
              .addColumns((String) r.get("parentColumn"), (String) r.get("childColumn"))
              .toRelationship(db);
        }
      }
    }
    return tables.size();
  }

  static DataType dataType(String type) {
    switch (type) {
      case "autonumber": return DataType.LONG;
      case "integer": return DataType.LONG;
      case "decimal": return DataType.DOUBLE;
      case "currency": return DataType.MONEY;
      case "date": return DataType.SHORT_DATE_TIME;
      case "boolean": return DataType.BOOLEAN;
      case "binary": return DataType.OLE;
      case "longText": return DataType.MEMO;
      default: return DataType.TEXT;
    }
  }

  static Object convert(Object v, String type) {
    if (v == null) return null;
    String text = String.valueOf(v);
    try {
      switch (type) {
        case "autonumber":
        case "integer":
          return v instanceof Number ? ((Number) v).intValue() : (int) Double.parseDouble(text.trim());
        case "decimal":
          return v instanceof Number ? ((Number) v).doubleValue() : Double.parseDouble(text.trim().replace(',', '.'));
        case "currency":
          return new BigDecimal(text.trim().replace(',', '.'));
        case "boolean":
          if (v instanceof Boolean) return v;
          return text.equals("1") || text.equalsIgnoreCase("true") || text.equalsIgnoreCase("sí") || text.equalsIgnoreCase("si");
        case "date":
          return parseDate(text.trim());
        case "binary":
          return text.startsWith("base64:") ? Base64.getDecoder().decode(text.substring(7)) : text.getBytes(StandardCharsets.UTF_8);
        case "shortText":
          return text.length() > 255 ? text.substring(0, 255) : text;
        default:
          return text;
      }
    } catch (RuntimeException e) {
      // Un valor que no encaja en el tipo se deja vacío en lugar de abortar.
      return type.equals("shortText") || type.equals("longText") ? text : null;
    }
  }

  static LocalDateTime parseDate(String text) {
    if (text.isEmpty()) return null;
    String t = text.replace('T', ' ');
    try {
      if (t.length() == 10) return LocalDate.parse(t).atStartOfDay();
      if (t.length() >= 19) return LocalDateTime.parse(t.substring(0, 19).replace(' ', 'T'));
      if (t.length() == 16) return LocalDateTime.parse(t.replace(' ', 'T') + ":00");
    } catch (DateTimeParseException ignored) {
      // cae al final
    }
    return null;
  }
}
