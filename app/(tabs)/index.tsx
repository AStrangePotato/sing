import { Link } from "expo-router";
import { Text, View, StyleSheet} from "react-native";

export default function Index() {
  return (
    <View style={styles.container}>
      <Text>Edit app/index.tsx to easddit this screen.</Text>
      <Link href={"/record"}>Record</Link>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
  },
});
