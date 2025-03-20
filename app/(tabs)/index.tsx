import { Link } from "expo-router";
import { Text, View, StyleSheet} from "react-native";

export default function Index() {
  return (
    <View style={styles.container}>
      <Text>Testasd</Text>
      <Link href={"/record"}>Record</Link>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
  },
});
