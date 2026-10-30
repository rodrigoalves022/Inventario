//go:build !windows && !linux

package anydesk

// CollectID nao e suportado nesta plataforma.
func CollectID() string { return "" }
