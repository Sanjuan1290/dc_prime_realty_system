import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFetch as fetchJson } from '../../../utils/useFetch'

const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * Looks up other Networks that already use this Broker Name. Two brokers can
 * share a name, so this never blocks by itself; the form asks the user to
 * confirm it is a different broker before saving.
 *
 * `originalBrokerName` (edit only): no warning while the name is unchanged.
 */
export const useBrokerNameMatches = (brokerName, { excludeGroupId = null, originalBrokerName = '' } = {}) => {
  const [debounced, setDebounced] = useState(normalize(brokerName))
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(normalize(brokerName)), 400)
    return () => clearTimeout(timer)
  }, [brokerName])

  const unchanged = Boolean(originalBrokerName) && debounced === normalize(originalBrokerName)
  const query = useQuery({
    queryKey: ['network-broker-check', debounced, excludeGroupId || null],
    queryFn: () => fetchJson(`/seller-groups/broker-check?broker_name=${encodeURIComponent(debounced)}${excludeGroupId ? `&excludeGroupId=${excludeGroupId}` : ''}`),
    enabled: debounced.length >= 3 && !unchanged,
    staleTime: 30_000,
  })
  const matches = unchanged || debounced.length < 3 ? [] : (query.data?.data?.matches || [])
  return { matches, isChecking: query.isFetching, checkedName: debounced }
}

/** Matches returned by the server when it refuses an unconfirmed duplicate. */
export const getDuplicateBrokerMatches = (error) => (
  error?.code === 'DUPLICATE_BROKER_NAME' ? (error?.data?.details?.matches || []) : null
)
