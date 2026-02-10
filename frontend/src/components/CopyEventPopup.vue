<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div class="bg-white rounded-lg shadow-lg w-96 p-6">
      <!-- Header -->
      <h2 class="text-2xl font-bold mb-4">Copy Event</h2>
      <p class="text-gray-600 mb-6">
        Select one or more dates to copy "<strong>{{ sourceEvent?.title }}</strong>" to
      </p>

      <!-- Mini Calendar -->
      <div class="mb-6">
        <div class="flex justify-between items-center mb-4">
          <button @click="prevMonth" class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">
            ←
          </button>
          <h3 class="font-semibold">
            {{ currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' }) }}
          </h3>
          <button @click="nextMonth" class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">
            →
          </button>
        </div>

        <!-- Day headers -->
        <div class="grid grid-cols-7 gap-1 mb-2">
          <div v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="day"
            class="text-center text-sm font-semibold text-gray-600">
            {{ day }}
          </div>
        </div>

        <!-- Calendar grid -->
        <div class="grid grid-cols-7 gap-1">
          <button
            v-for="date in calendarDays"
            :key="date.toISOString()"
            @click="toggleDate(date)"
            :disabled="isSourceDate(date)"
            :class="{
              'bg-blue-500 text-white': isSelected(date),
              'bg-gray-100 text-gray-400 cursor-not-allowed': isSourceDate(date),
              'bg-white border border-gray-300 hover:bg-gray-50': !isSelected(date) && !isSourceDate(date),
              'opacity-50': !isCurrentMonth(date),
            }"
            class="h-10 rounded text-sm font-medium transition">
            {{ date.getDate() }}
          </button>
        </div>
      </div>

      <!-- Selection summary -->
      <div class="mb-6 p-4 bg-blue-50 rounded">
        <p class="text-sm text-gray-700">
          <strong>{{ selectedDates.length }}</strong> date{{ selectedDates.length !== 1 ? 's' : '' }} selected
        </p>
        <div v-if="selectedDates.length > 0" class="mt-2 flex flex-wrap gap-2">
          <span
            v-for="date in selectedDates"
            :key="date.toISOString()"
            class="inline-block bg-blue-200 text-blue-900 px-2 py-1 rounded text-xs">
            {{ date.toLocaleDateString('en-US') }}
            <button @click="removeDate(date)" class="ml-1 font-bold">×</button>
          </span>
        </div>
      </div>

      <!-- Confirmation -->
      <div v-if="selectedDates.length > 0" class="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p class="text-sm text-yellow-900">
          This will create <strong>{{ selectedDates.length }}</strong> new event(s).
        </p>
      </div>

      <!-- Actions -->
      <div class="flex gap-3">
        <button
          @click="cancel"
          class="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition">
          Cancel
        </button>
        <button
          @click="confirm"
          :disabled="selectedDates.length === 0 || isLoading"
          :class="{
            'opacity-50 cursor-not-allowed': selectedDates.length === 0 || isLoading,
          }"
          class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">
          {{ isLoading ? 'Copying...' : 'Copy' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { CalendarEvent } from '../types'

interface Props {
  isOpen: boolean
  sourceEvent: CalendarEvent | null
  onConfirm: (dates: Date[]) => Promise<void>
  onCancel: () => void
}

const props = defineProps<Props>()

const selectedDates = ref<Date[]>([])
const currentMonth = ref(new Date())
const isLoading = ref(false)

const calendarDays = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - firstDay.getDay())

  const days: Date[] = []
  const current = new Date(startDate)

  while (current <= lastDay || current.getDay() !== 0) {
    days.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  return days
})

const isCurrentMonth = (date: Date) => {
  return date.getMonth() === currentMonth.value.getMonth()
}

const isSourceDate = (date: Date) => {
  if (!props.sourceEvent) return false
  return isSameDay(date, props.sourceEvent.start)
}

const isSelected = (date: Date) => {
  return selectedDates.value.some(d => isSameDay(d, date))
}

const isSameDay = (a: Date, b: Date) => {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

const toggleDate = (date: Date) => {
  if (isSourceDate(date)) return

  const index = selectedDates.value.findIndex(d => isSameDay(d, date))
  if (index > -1) {
    selectedDates.value.splice(index, 1)
  } else {
    selectedDates.value.push(new Date(date))
  }
}

const removeDate = (date: Date) => {
  const index = selectedDates.value.findIndex(d => isSameDay(d, date))
  if (index > -1) {
    selectedDates.value.splice(index, 1)
  }
}

const prevMonth = () => {
  currentMonth.value = new Date(
    currentMonth.value.getFullYear(),
    currentMonth.value.getMonth() - 1,
    1
  )
}

const nextMonth = () => {
  currentMonth.value = new Date(
    currentMonth.value.getFullYear(),
    currentMonth.value.getMonth() + 1,
    1
  )
}

const confirm = async () => {
  if (selectedDates.length === 0) return

  isLoading.value = true
  try {
    await props.onConfirm(selectedDates.value)
    reset()
  } finally {
    isLoading.value = false
  }
}

const cancel = () => {
  reset()
  props.onCancel()
}

const reset = () => {
  selectedDates.value = []
  currentMonth.value = new Date()
}

onMounted(() => {
  if (props.sourceEvent) {
    currentMonth.value = new Date(props.sourceEvent.start)
  }
})
</script>

<style scoped>
button:disabled {
  cursor: not-allowed;
}
</style>
