import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, recoverKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      recoverKey: prev.recoverKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Algo salio mal</Text>
          <Text style={styles.errorName}>{err?.name}</Text>
          <Text style={styles.message}>{err?.message}</Text>
          <Text style={styles.stack}>{(err?.stack || "").split("\n").slice(0, 6).join("\n")}</Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return <View key={this.state.recoverKey} style={{ flex: 1 }}>{this.props.children}</View>;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  errorName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#ff6b6b",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: "#ccc",
    textAlign: "center",
    marginBottom: 12,
  },
  stack: {
    fontSize: 10,
    color: "#888",
    textAlign: "left",
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  button: {
    backgroundColor: "#00ab67",
    borderRadius: 8,
    padding: 16,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
